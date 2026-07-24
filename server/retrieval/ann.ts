/**
 * @file ann.ts
 * @description SP-3.3: dense (semantic) retrieval via pgvector ANN search.
 * Embeds only the query — never the corpus, which is embedded once at
 * ingest time (SP-3.1). This is the direct fix for S6 (hybridSearch.ts's
 * O(corpus) per-query re-embedding): a search here costs exactly one
 * embedding call regardless of corpus size.
 */

import type { Pool } from 'pg';
import type { GoogleGenAI } from '@google/genai';

export interface DenseSearchResult {
  id: string;
  similarity: number;
}

function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Embeds `query` once, then finds the `limit` nearest chunks by cosine
 * similarity using the HNSW index on document_chunks.embedding. Similarity
 * is returned as 1 - cosine_distance (so higher is more similar, matching
 * the convention used by hybridSearch.ts's client-side cosineSimilarity).
 */
export async function searchDense(
  query: string,
  limit: number,
  deps: { pool: Pool; ai: GoogleGenAI }
): Promise<DenseSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const response = await deps.ai.models.embedContent({
    model: 'text-embedding-004',
    contents: trimmed.slice(0, 2048),
  });
  const result = response as any;
  const vector: number[] | undefined = result.embedding?.values ?? result.embeddings?.[0]?.values;

  if (!vector) {
    throw new Error('query embedding failed: empty response');
  }

  const client = await deps.pool.connect();
  try {
    const queryResult = await client.query(
      `SELECT id, 1 - (embedding <=> $1) AS similarity
       FROM document_chunks
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [toPgVectorLiteral(vector), limit]
    );

    return queryResult.rows.map((row: any) => ({ id: row.id, similarity: Number(row.similarity) }));
  } finally {
    client.release();
  }
}
