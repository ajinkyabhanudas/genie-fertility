import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding, cosineSimilarity } from './embeddingService';

// Mocks global fetch — this test makes zero network requests and zero live
// model calls, per project policy (fixture/mock-only testing, no live API spend).
describe('getEmbedding', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns a semantic vector when the proxy responds successfully', async () => {
    const vector = new Array(768).fill(0.1);
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ vector }),
    });

    const result = await getEmbedding('endometriosis biomarkers');

    expect(result.mode).toBe('semantic');
    expect(result.vector).toEqual(vector);
  });

  it('falls back to the deterministic vectorizer when the proxy returns a non-ok response', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'embedding_unavailable' }),
    });

    const result = await getEmbedding('endometriosis biomarkers');

    expect(result.mode).toBe('fallback');
    expect(result.vector).toHaveLength(768);
  });

  it('falls back to the deterministic vectorizer when the proxy response has no vector field', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const result = await getEmbedding('endometriosis biomarkers');

    expect(result.mode).toBe('fallback');
    expect(result.vector).toHaveLength(768);
  });

  it('falls back to the deterministic vectorizer when fetch throws (network error)', async () => {
    (fetch as any).mockRejectedValue(new Error('network down'));

    const result = await getEmbedding('endometriosis biomarkers');

    expect(result.mode).toBe('fallback');
    expect(result.vector).toHaveLength(768);
  });

  it('fallback vectorizer is deterministic for the same input text', async () => {
    (fetch as any).mockRejectedValue(new Error('network down'));

    const a = await getEmbedding('same text');
    const b = await getEmbedding('same text');

    expect(a.vector).toEqual(b.vector);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('returns 0 for mismatched lengths or empty vectors', () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});
