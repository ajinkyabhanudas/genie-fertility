import { describe, it, expect, vi } from 'vitest';
import { searchDense } from './ann';

function makeMockAi(vector: number[] = new Array(768).fill(0.1)) {
  return {
    models: {
      embedContent: vi.fn(async () => ({ embedding: { values: vector } })),
    },
  } as any;
}

function makeMockPool(rows: { id: string; similarity: number }[]) {
  const client = {
    query: vi.fn(async () => ({ rows })),
    release: vi.fn(),
  };
  return { connect: vi.fn(async () => client), _client: client } as any;
}

describe('searchDense', () => {
  it('embeds the query exactly once per search', async () => {
    const ai = makeMockAi();
    const pool = makeMockPool([{ id: 'chunk-1', similarity: 0.92 }]);

    await searchDense('recurrent implantation failure', 10, { pool, ai });

    expect(ai.models.embedContent).toHaveBeenCalledTimes(1);
  });

  it('returns results ordered by similarity as given by the query', async () => {
    const ai = makeMockAi();
    const pool = makeMockPool([
      { id: 'chunk-a', similarity: 0.95 },
      { id: 'chunk-b', similarity: 0.60 },
    ]);

    const results = await searchDense('endometriosis biomarkers', 10, { pool, ai });

    expect(results).toEqual([
      { id: 'chunk-a', similarity: 0.95 },
      { id: 'chunk-b', similarity: 0.60 },
    ]);
  });

  it('returns empty array for empty/whitespace query without calling embed or DB', async () => {
    const ai = makeMockAi();
    const pool = makeMockPool([]);

    const results = await searchDense('   ', 10, { pool, ai });

    expect(results).toEqual([]);
    expect(ai.models.embedContent).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('throws when the embedding response is empty', async () => {
    const ai = { models: { embedContent: vi.fn(async () => ({})) } } as any;
    const pool = makeMockPool([]);

    await expect(searchDense('query', 10, { pool, ai })).rejects.toThrow('query embedding failed');
  });

  it('passes limit through to the query', async () => {
    const ai = makeMockAi();
    const pool = makeMockPool([]);

    await searchDense('query', 7, { pool, ai });

    expect(pool._client.query).toHaveBeenCalledWith(expect.any(String), [expect.any(String), 7]);
  });

  it('never re-embeds per candidate — exactly one embed call regardless of corpus size', async () => {
    const ai = makeMockAi();
    const pool = makeMockPool(
      Array.from({ length: 500 }, (_, i) => ({ id: `chunk-${i}`, similarity: 0.5 }))
    );

    await searchDense('query', 500, { pool, ai });

    expect(ai.models.embedContent).toHaveBeenCalledTimes(1);
  });
});
