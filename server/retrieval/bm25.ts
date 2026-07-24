/**
 * @file bm25.ts
 * @description SP-3.2: real sparse (lexical) scoring over `document_chunks`,
 * replacing hybridSearch.ts's regex term-counter (S5 — no IDF, no doc-length
 * normalisation, no corpus statistics). Uses Postgres full-text search's
 * `ts_rank_cd` over the `fts_vector` column SP-3.1's ingest pipeline
 * populates — real IDF-weighted, length-normalised ranking computed from
 * actual corpus statistics, not a per-query toy score.
 *
 * `websearch_to_tsquery` is used (not `plainto_tsquery`) so phrase queries
 * ("recurrent implantation failure") and operators degrade gracefully for a
 * clinical search tool where exact-phrase precision matters, while still
 * accepting plain keyword input unchanged.
 */

import type { Pool } from 'pg';

export interface SparseSearchResult {
  id: string;
  score: number;
}

/**
 * Ranks chunks already ingested into `document_chunks` by lexical relevance
 * to `query`. Returns at most `limit` results ordered by score descending.
 * A query with zero matching terms returns an empty array (no candidate has
 * a positive score) — never a false-positive "everything matches" ranking.
 */
export async function searchSparse(
  query: string,
  limit: number,
  deps: { pool: Pool }
): Promise<SparseSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const client = await deps.pool.connect();
  try {
    const result = await client.query(
      `SELECT id, ts_rank_cd(fts_vector, websearch_to_tsquery('english', $1)) AS score
       FROM document_chunks
       WHERE fts_vector @@ websearch_to_tsquery('english', $1)
       ORDER BY score DESC
       LIMIT $2`,
      [trimmed, limit]
    );

    return result.rows.map((row: any) => ({ id: row.id, score: Number(row.score) }));
  } finally {
    client.release();
  }
}
