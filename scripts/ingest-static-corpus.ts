/**
 * @file ingest-static-corpus.ts
 * @description One-off runner that ingests STATIC_CORPUS into document_chunks
 * via server/retrieval/ingest.ts. Deferred from SP-3.1 (no caller existed yet)
 * to SP-3.4, once /api/retrieve gave this a real reason to exist. Safe to
 * re-run — ingestChunks() is idempotent by content hash.
 *
 * Usage: node --env-file=.env --import tsx scripts/ingest-static-corpus.ts
 */

import { GoogleGenAI } from '@google/genai';
import { pool } from '../server/db/pool';
import { ingestChunks, type IngestChunkInput } from '../server/retrieval/ingest';
import { STATIC_CORPUS } from '../src/services/rag/staticCorpus';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is required to embed the static corpus.');
    process.exitCode = 1;
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  const chunks: IngestChunkInput[] = STATIC_CORPUS.map((chunk) => ({
    id: chunk.id,
    refTag: chunk.refTag,
    title: chunk.title,
    abstract: chunk.abstract,
    text: chunk.text,
    source: chunk.source,
    sourceName: chunk.sourceName,
    url: chunk.url,
    doi: chunk.doi,
    pmid: chunk.pmid,
    nctId: chunk.nctId,
    publicationDate: chunk.publicationDate,
    authors: chunk.authors,
  }));

  const summary = await ingestChunks(chunks, { pool, ai });
  console.log(JSON.stringify({ event: 'static_corpus_ingest_complete', ...summary }));

  await pool.end();
}

main().catch((error) => {
  console.error('Static corpus ingest failed:', error);
  process.exitCode = 1;
});
