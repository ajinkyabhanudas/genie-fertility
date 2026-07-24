import { describe, it, expect, vi } from 'vitest';
import { retrieve } from './index';
import * as bm25 from './bm25';
import * as ann from './ann';

vi.mock('./bm25');
vi.mock('./ann');

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

  it('ranks a chunk appearing in both lists above one appearing in only one', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([
      { id: 'both', score: 0.7 },
      { id: 'sparse-only', score: 0.9 },
    ]);
    vi.mocked(ann.searchDense).mockResolvedValue([{ id: 'both', similarity: 0.6 }]);
    const pool = makeMockPool({ both: makeChunkRow('both'), 'sparse-only': makeChunkRow('sparse-only') });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.chunks[0].id).toBe('both');
  });

  it('degrades to sparse-only when dense search throws, never fails the request', async () => {
    vi.mocked(bm25.searchSparse).mockResolvedValue([{ id: 'a', score: 0.8 }]);
    vi.mocked(ann.searchDense).mockRejectedValue(new Error('embed failed'));
    const pool = makeMockPool({ a: makeChunkRow('a') });

    const result = await retrieve('query', 5, { pool, ai: mockAi });

    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toBe('dense_search_failed');
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
  });

  it('respects topK when truncating fused results', async () => {
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
});
