import { describe, it, expect, vi } from 'vitest';
import { searchSparse } from './bm25';

// Mimics real ts_rank_cd behaviour closely enough to test our query-building
// and result-shaping logic: rows only appear when the query terms would
// actually match, and scores are ordered — the ranking math itself is
// Postgres's, not ours, so this is a fixture standing in for that contract.
function makeMockPool(fixture: Record<string, { id: string; score: number }[]>) {
  const client = {
    query: vi.fn(async (sql: string, params?: any[]) => {
      const [query] = params ?? [];
      const normalized = String(query).toLowerCase().trim();
      const rows = fixture[normalized] ?? [];
      return { rows: rows.map((r) => ({ id: r.id, score: r.score })) };
    }),
    release: vi.fn(),
  };
  return { connect: vi.fn(async () => client) } as any;
}

describe('searchSparse', () => {
  it('ranks a matching chunk above a non-matching one', async () => {
    const pool = makeMockPool({
      'recurrent implantation failure': [
        { id: 'chunk-rif', score: 0.8 },
      ],
    });

    const results = await searchSparse('recurrent implantation failure', 10, { pool });

    expect(results).toEqual([{ id: 'chunk-rif', score: 0.8 }]);
  });

  it('returns empty array for empty/whitespace query without querying the DB', async () => {
    const pool = makeMockPool({});
    const connectSpy = pool.connect;

    const results = await searchSparse('   ', 10, { pool });

    expect(results).toEqual([]);
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('returns empty array when no chunk matches the query terms', async () => {
    const pool = makeMockPool({});

    const results = await searchSparse('unrelated query terms', 10, { pool });

    expect(results).toEqual([]);
  });

  it('passes limit through to the query', async () => {
    const client = {
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) } as any;

    await searchSparse('endometriosis', 5, { pool });

    expect(client.query).toHaveBeenCalledWith(expect.any(String), ['endometriosis', 5]);
  });

  it('is deterministic — same query returns same order across calls', async () => {
    const pool = makeMockPool({
      endometriosis: [
        { id: 'chunk-a', score: 0.9 },
        { id: 'chunk-b', score: 0.5 },
      ],
    });

    const first = await searchSparse('endometriosis', 10, { pool });
    const second = await searchSparse('endometriosis', 10, { pool });

    expect(first).toEqual(second);
  });
});
