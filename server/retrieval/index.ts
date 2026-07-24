/**
 * @file index.ts
 * @description SP-3.4: the real retrieval pipeline — query-embed once, dense
 * ANN (SP-3.3) + sparse FTS (SP-3.2) in parallel, RRF merge (same k=60 math
 * as hybridSearch.ts, now fusing real signals instead of a regex score),
 * then hydrate the fused top-k with full chunk rows for the caller.
 *
 * Reranking (SP-3.5) and provenance gating (SP-3.6) are not yet wired here —
 * this pipeline's output is exactly the "clean service" those phases will
 * sit on top of.
 */

import type { Pool } from 'pg';
import type { GoogleGenAI } from '@google/genai';
import { searchSparse } from './bm25';
import { searchDense } from './ann';

export interface RetrievedChunk {
  id: string;
  refTag: string;
  title: string;
  abstract: string | null;
  text: string;
  source: string;
  sourceName: string;
  url: string | null;
  doi: string | null;
  pmid: string | null;
  nctId: string | null;
  publicationDate: string | null;
  authors: string[] | null;
  rrfScore: number;
  bm25Rank: number | null;
  denseRank: number | null;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];
  degraded: boolean;
  degradedReason?: string;
}

const RRF_K = 60;

function computeRrf(
  sparse: { id: string; score: number }[],
  dense: { id: string; similarity: number }[]
): Map<string, { rrfScore: number; bm25Rank: number | null; denseRank: number | null }> {
  const bm25RankMap = new Map<string, number>();
  sparse.forEach((item, idx) => bm25RankMap.set(item.id, idx + 1));

  const denseRankMap = new Map<string, number>();
  dense.forEach((item, idx) => denseRankMap.set(item.id, idx + 1));

  const allIds = new Set<string>([...bm25RankMap.keys(), ...denseRankMap.keys()]);
  const fused = new Map<string, { rrfScore: number; bm25Rank: number | null; denseRank: number | null }>();

  for (const id of allIds) {
    const bm25Rank = bm25RankMap.get(id) ?? null;
    const denseRank = denseRankMap.get(id) ?? null;
    const rrfScore = 1 / (RRF_K + (bm25Rank ?? Infinity)) + 1 / (RRF_K + (denseRank ?? Infinity));
    fused.set(id, { rrfScore, bm25Rank, denseRank });
  }

  return fused;
}

/**
 * Retrieves the top-`topK` chunks for `query`. Dense search failure (e.g.
 * the query-embed call fails) degrades to sparse-only results rather than
 * failing the request outright — mirrors the SP-1 RetrievalState contract:
 * never silently present a degraded result as fully grounded.
 */
export async function retrieve(
  query: string,
  topK: number,
  deps: { pool: Pool; ai: GoogleGenAI; candidatePoolSize?: number }
): Promise<RetrieveResult> {
  const candidateLimit = deps.candidatePoolSize ?? 50;
  let degraded = false;
  let degradedReason: string | undefined;

  const sparsePromise = searchSparse(query, candidateLimit, { pool: deps.pool });
  const densePromise = searchDense(query, candidateLimit, { pool: deps.pool, ai: deps.ai }).catch((error) => {
    degraded = true;
    degradedReason = 'dense_search_failed';
    console.log(JSON.stringify({ event: 'retrieve_degraded', reason: degradedReason, error: String(error) }));
    return [] as { id: string; similarity: number }[];
  });

  const [sparse, dense] = await Promise.all([sparsePromise, densePromise]);

  const fused = computeRrf(sparse, dense);
  const topIds = Array.from(fused.entries())
    .sort((a, b) => b[1].rrfScore - a[1].rrfScore)
    .slice(0, topK)
    .map(([id]) => id);

  if (topIds.length === 0) {
    return { chunks: [], degraded, degradedReason };
  }

  const client = await deps.pool.connect();
  try {
    const result = await client.query(
      `SELECT id, ref_tag, title, abstract, text, source, source_name, url, doi,
              pmid, nct_id, publication_date, authors
       FROM document_chunks
       WHERE id = ANY($1)`,
      [topIds]
    );

    const rowsById = new Map(result.rows.map((row: any) => [row.id, row]));

    const chunks: RetrievedChunk[] = topIds
      .filter((id) => rowsById.has(id))
      .map((id) => {
        const row = rowsById.get(id);
        const fusedEntry = fused.get(id)!;
        return {
          id: row.id,
          refTag: row.ref_tag,
          title: row.title,
          abstract: row.abstract,
          text: row.text,
          source: row.source,
          sourceName: row.source_name,
          url: row.url,
          doi: row.doi,
          pmid: row.pmid,
          nctId: row.nct_id,
          publicationDate: row.publication_date,
          authors: row.authors,
          rrfScore: fusedEntry.rrfScore,
          bm25Rank: fusedEntry.bm25Rank,
          denseRank: fusedEntry.denseRank,
        };
      });

    return { chunks, degraded, degradedReason };
  } finally {
    client.release();
  }
}
