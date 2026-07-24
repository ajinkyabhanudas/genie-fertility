/**
 * @file ingest.ts
 * @description SP-3.1: idempotent ingest pipeline for `document_chunks`.
 * Embeds each chunk exactly once (skipped entirely if its content is
 * unchanged since the last ingest) and stores the vector + FTS tsvector +
 * metadata server-side. This is the seam that kills the per-query
 * re-embedding S6 identified in hybridSearch.ts: SP-3.4's query path will
 * only ever embed the query, never the corpus, because the corpus is
 * embedded once here.
 */

import crypto from 'crypto';
import type { Pool } from 'pg';
import type { GoogleGenAI } from '@google/genai';

export interface IngestChunkInput {
  id: string;
  refTag: string;
  title: string;
  abstract?: string;
  text: string;
  source: string;
  sourceName: string;
  url?: string;
  doi?: string;
  pmid?: string;
  nctId?: string;
  publicationDate?: string;
  authors?: string[];
}

export interface IngestSummary {
  embedded: number;
  skippedUnchanged: number;
  failed: number;
  total: number;
}

function contentHash(chunk: IngestChunkInput): string {
  return crypto
    .createHash('sha256')
    .update(`${chunk.title}|${chunk.abstract ?? ''}|${chunk.text}`)
    .digest('hex');
}

// youk: assumes embedContent always returns finite floats — upgrade to a
// Number.isFinite validation pass when a malformed/NaN embedding response is
// ever observed in practice (would currently throw at INSERT, caught below
// as an insert_failed/isolated-per-chunk outcome, not silently corrupt data).
function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Ingests a batch of chunks. Each chunk's embed call happens only if its
 * content hash differs from what's already stored for that id — a failed
 * embed on one chunk is logged and skipped, never aborts the batch.
 */
export async function ingestChunks(
  chunks: IngestChunkInput[],
  deps: { pool: Pool; ai: GoogleGenAI }
): Promise<IngestSummary> {
  const summary: IngestSummary = { embedded: 0, skippedUnchanged: 0, failed: 0, total: chunks.length };
  const client = await deps.pool.connect();

  try {
    for (const chunk of chunks) {
      const hash = contentHash(chunk);

      const existing = await client.query(
        'SELECT content_hash FROM document_chunks WHERE id = $1',
        [chunk.id]
      );

      if (existing.rows.length > 0 && existing.rows[0].content_hash === hash) {
        summary.skippedUnchanged += 1;
        console.log(JSON.stringify({ event: 'ingest_chunk', id: chunk.id, outcome: 'skipped_unchanged' }));
        continue;
      }

      let vector: number[];
      try {
        const response = await deps.ai.models.embedContent({
          model: 'text-embedding-004',
          contents: chunk.text.slice(0, 2048),
        });
        const result = response as any;
        vector = result.embedding?.values ?? result.embeddings?.[0]?.values;
        if (!vector) throw new Error('empty embedding response');
      } catch (error) {
        summary.failed += 1;
        console.log(JSON.stringify({ event: 'ingest_chunk', id: chunk.id, outcome: 'embed_failed', error: String(error) }));
        continue;
      }

      const ftsText = `${chunk.title} ${chunk.abstract ?? ''} ${chunk.text}`;

      try {
        await client.query(
          `INSERT INTO document_chunks
             (id, ref_tag, title, abstract, text, source, source_name, url, doi,
              pmid, nct_id, publication_date, authors, embedding, content_hash, fts_vector)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, to_tsvector('english', $16))
           ON CONFLICT (id) DO UPDATE SET
             ref_tag = EXCLUDED.ref_tag,
             title = EXCLUDED.title,
             abstract = EXCLUDED.abstract,
             text = EXCLUDED.text,
             source = EXCLUDED.source,
             source_name = EXCLUDED.source_name,
             url = EXCLUDED.url,
             doi = EXCLUDED.doi,
             pmid = EXCLUDED.pmid,
             nct_id = EXCLUDED.nct_id,
             publication_date = EXCLUDED.publication_date,
             authors = EXCLUDED.authors,
             embedding = EXCLUDED.embedding,
             content_hash = EXCLUDED.content_hash,
             fts_vector = EXCLUDED.fts_vector
           WHERE document_chunks.content_hash IS DISTINCT FROM EXCLUDED.content_hash`,
          [
            chunk.id,
            chunk.refTag,
            chunk.title,
            chunk.abstract ?? null,
            chunk.text,
            chunk.source,
            chunk.sourceName,
            chunk.url ?? null,
            chunk.doi ?? null,
            chunk.pmid ?? null,
            chunk.nctId ?? null,
            chunk.publicationDate ?? null,
            chunk.authors ?? null,
            toPgVectorLiteral(vector),
            hash,
            ftsText,
          ]
        );
      } catch (error) {
        summary.failed += 1;
        console.log(JSON.stringify({ event: 'ingest_chunk', id: chunk.id, outcome: 'insert_failed', error: String(error) }));
        continue;
      }

      summary.embedded += 1;
      console.log(JSON.stringify({ event: 'ingest_chunk', id: chunk.id, outcome: 'embedded' }));
    }
  } finally {
    client.release();
  }

  console.log(JSON.stringify({ event: 'ingest_batch_complete', ...summary }));
  return summary;
}
