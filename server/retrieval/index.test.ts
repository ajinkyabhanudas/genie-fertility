import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retrieve } from './index';
import * as bm25 from './bm25';
import * as ann from './ann';
import * as rerankModule from './rerank';

vi.mock('./bm25');
vi.mock('./ann');
vi.mock('./rerank');

function makeMockPool(chunkRows: Record<string, any>) {
  const client = {
    query: vi.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM document_chunks') && sql.includes('WHERE id = ANY')) {
        const ids: string[] = params?.[0] ?? [];
        return { rows: ids.filter((id) => chunkRows[id]).map((id) => chunkRows[id]) };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return { connect: vi.fn(async () => client) } as any;
}

function makeChunkRow(id: string) {
  return {
    id,
    ref_tag: `[REF-${id}]`,
    title: `Title ${id}`,
    abstract: `Abstract ${id}`,
    text: `Text ${id}`,
    source: 'static_corpus',
    source_name: 'Test Source',
    url: null,
    doi: null,
    pmid: null,
    nct_id: null,
    publication_date: null,
    authors: null,
  };
}

const mockAi = {} as any;

/** Default rerank mock: pass through in the input (RRF) order, unchanged. */
function stubRerankPassthrough() {
  vi.mocked(rerankModule.rerank).mockImplementation(async (_query, candidates) =>
    candidates.map((c) => ({ id: c.id, rerankScore: 0 }))
  );
}

beforeEach(() => {
  stubRerankPassthrough();
});

describe('retrieve', () => {
  it('fuses dense + sparse results via RRF and hydrates full chunk rows', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([{ id: 'a', score: 0.9 }]);
    vi.mocked(ann.searchDense).mockResolvedValue([{ id: 'a', similarity: 0.85 }]);
    const pool = makeMockPool({ a: makeChunkRow('a') });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.degraded).toBe(false);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].id).toBe('a');
    expect(result.chunks[0].bm25Rank).toBe(1);
    expect(result.chunks[0].denseRank).toBe(1);
    expect(result.chunks[0].rrfScore).toBeGreaterThan(0);
  });

  it('ranks a chunk appearing in both lists above one appearing in only one (pre-rerank RRF order)', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([
      { id: 'both', score: 0.7 },
      { id: 'sparse-only', score: 0.9 },
    ]);
    vi.mocked(ann.searchDense).mockResolvedValue([{ id: 'both', similarity: 0.6 }]);
    const pool = makeMockPool({ both: makeChunkRow('both'), 'sparse-only': makeChunkRow('sparse-only') });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.chunks[0].id).toBe('both');
  });

  it('degrades (dense_search_failed) when dense search throws, never fails the request', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([{ id: 'a', score: 0.8 }]);
    vi.mocked(ann.searchDense).mockRejectedValue(new Error('embed failed'));
    const pool = makeMockPool({ a: makeChunkRow('a') });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.degraded).toBe(true);
    expect(result.degradedReasons).toContain('dense_search_failed');
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].id).toBe('a');
  });

  it('returns empty chunks when neither search has candidates', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([]);
    vi.mocked(ann.searchDense).mockResolvedValue([]);
    const pool = makeMockPool({});

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.chunks).toEqual([]);
    expect(result.degraded).toBe(false);
    expect(result.degradedReasons).toEqual([]);
  });

  it('respects topK when truncating post-rerank results', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.8 },
      { id: 'c', score: 0.7 },
    ]);
    vi.mocked(ann.searchDense).mockResolvedValue([]);
    const pool = makeMockPool({ a: makeChunkRow('a'), b: makeChunkRow('b'), c: makeChunkRow('c') });

    const result = await retrieve('query', 2, { pool, ai: mockAi });

    expect(result.chunks).toHaveLength(2);
  });

  it('reranks the full candidate pool and reorders results by rerank score', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([
      { id: 'rrf-first', score: 0.9 },
      { id: 'rrf-second', score: 0.1 },
    ]);
    vi.mocked(ann.searchDense).mockResolvedValue([]);
    vi.mocked(rerankModule.rerank).mockResolvedValue([
      { id: 'rrf-second', rerankScore: 0.99 },
      { id: 'rrf-first', rerankScore: 0.1 },
    ]);
    const pool = makeMockPool({
      'rrf-first': makeChunkRow('rrf-first'),
      'rrf-second': makeChunkRow('rrf-second'),
    });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.degraded).toBe(false);
    expect(result.chunks[0].id).toBe('rrf-second'); // reranker inverted the RRF order
    expect(result.chunks[0].rerankScore).toBe(0.99);
  });

  it('falls back to RRF-only order and marks degraded when the reranker fails', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([{ id: 'a', score: 0.9 }]);
    vi.mocked(ann.searchDense).mockResolvedValue([]);
    vi.mocked(rerankModule.rerank).mockRejectedValue(new Error('model load failed'));
    const pool = makeMockPool({ a: makeChunkRow('a') });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.degraded).toBe(true);
    expect(result.degradedReasons).toContain('reranker_failed');
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].id).toBe('a');
    expect(result.chunks[0].rerankScore).toBeNull();
  });

  it('reports both failures when dense search and reranker both fail', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([{ id: 'a', score: 0.9 }]);
    vi.mocked(ann.searchDense).mockRejectedValue(new Error('embed failed'));
    vi.mocked(rerankModule.rerank).mockRejectedValue(new Error('model load failed'));
    const pool = makeMockPool({ a: makeChunkRow('a') });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.degradedReasons).toEqual(['dense_search_failed', 'reranker_failed']);
  });
});
