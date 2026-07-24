/**
 * @file index.ts
 * @description The real retrieval pipeline — query-embed once, dense ANN
 * (SP-3.3) + sparse FTS (SP-3.2) in parallel, RRF merge (same k=60 math as
 * hybridSearch.ts, now fusing real signals instead of a regex score),
 * hydrate the full RRF candidate pool, then rerank (SP-3.5) down to top-k.
 *
 * Retrieve-50 -> rerank-5: RRF fuses and ranks the full candidate pool
 * (candidatePoolSize, default 50), all of it is hydrated with full text,
 * the reranker cross-encodes (query, text) for every candidate and
 * re-orders, then only the final top-k is returned. Reranker failure
 * (model load or inference) falls back to RRF-only ordering, marked
 * degraded — never a hard failure (DECISIONS.md D1).
 *
 * Provenance gating (SP-3.6) is not yet wired here — this pipeline's
 * output is exactly the "clean service" that phase will sit on top of.
 */

import type { Pool } from 'pg';
import type { GoogleGenAI } from '@google/genai';
import { searchSparse } from './bm25';
import { searchDense } from './ann';
import { rerank } from './rerank';

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
  rerankScore: number | null;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];
  degraded: boolean;
  degradedReasons: string[];
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
  const degradedReasons: string[] = [];

  const sparsePromise = searchSparse(query, candidateLimit, { pool: deps.pool });
  const densePromise = searchDense(query, candidateLimit, { pool: deps.pool, ai: deps.ai }).catch((error) => {
    degradedReasons.push('dense_search_failed');
    console.log(JSON.stringify({ event: 'retrieve_degraded', reason: 'dense_search_failed', error: String(error) }));
    return [] as { id: string; similarity: number }[];
  });

  const [sparse, dense] = await Promise.all([sparsePromise, densePromise]);

  const fused = computeRrf(sparse, dense);
  const candidateIds = Array.from(fused.entries())
    .sort((a, b) => b[1].rrfScore - a[1].rrfScore)
    .map(([id]) => id);

  if (candidateIds.length === 0) {
    return { chunks: [], degraded: degradedReasons.length > 0, degradedReasons };
  }

  const client = await deps.pool.connect();
  let rowsById: Map<string, any>;
  try {
    const result = await client.query(
      `SELECT id, ref_tag, title, abstract, text, source, source_name, url, doi,
              pmid, nct_id, publication_date, authors
       FROM document_chunks
       WHERE id = ANY($1)`,
      [candidateIds]
    );
    rowsById = new Map(result.rows.map((row: any) => [row.id, row]));
  } finally {
    client.release();
  }

  const hydratedIds = candidateIds.filter((id) => rowsById.has(id));

  let orderedIds = hydratedIds;
  let rerankScoreById = new Map<string, number>();
  try {
    const rerankInput = hydratedIds.map((id) => ({ id, text: rowsById.get(id).text }));
    const reranked = await rerank(query, rerankInput);
    orderedIds = reranked.map((r) => r.id);
    rerankScoreById = new Map(reranked.map((r) => [r.id, r.rerankScore]));
  } catch (error) {
    degradedReasons.push('reranker_failed');
    console.log(JSON.stringify({ event: 'retrieve_degraded', reason: 'reranker_failed', error: String(error) }));
  }

  const topIds = orderedIds.slice(0, topK);

  const chunks: RetrievedChunk[] = topIds.map((id) => {
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
      rerankScore: rerankScoreById.get(id) ?? null,
    };
  });

  return { chunks, degraded: degradedReasons.length > 0, degradedReasons };
}
