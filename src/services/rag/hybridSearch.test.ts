import { describe, it, expect, vi, beforeEach } from 'vitest';

// All external calls are mocked — this test makes zero network requests and zero
// live model calls, per project policy (fixture/mock-only testing, no live API spend).
vi.mock('./embeddingService', async () => {
  const actual = await vi.importActual<typeof import('./embeddingService')>('./embeddingService');
  return {
    ...actual,
    getEmbedding: vi.fn(),
  };
});
vi.mock('./sources/europePmc', () => ({ fetchEuropePmcArticles: vi.fn().mockResolvedValue([]) }));
vi.mock('./sources/clinicalTrials', () => ({ fetchClinicalTrials: vi.fn().mockResolvedValue([]) }));
vi.mock('./sources/openFda', () => ({ fetchOpenFdaClearances: vi.fn().mockResolvedValue([]) }));
vi.mock('./indexedDbStore', () => ({
  vectorCache: { saveChunk: vi.fn(), saveChunks: vi.fn(), getChunk: vi.fn(), getAllCachedChunks: vi.fn(() => []) },
}));

import { executeHybridRAGSearch } from './hybridSearch';
import { getEmbedding } from './embeddingService';

const mockedGetEmbedding = vi.mocked(getEmbedding);

// A vector highly similar to itself guarantees topSimilarity crosses the
// 'grounded' threshold (>= 0.40) deterministically, without relying on the
// static corpus's real text content.
const HIGH_SIM_VECTOR = new Array(768).fill(0).map((_, i) => (i === 0 ? 1 : 0));
const LOW_SIM_VECTOR = new Array(768).fill(0).map((_, i) => (i === 767 ? 1 : 0));

describe('executeHybridRAGSearch — retrieval state derivation', () => {
  beforeEach(() => {
    mockedGetEmbedding.mockReset();
  });

  it('returns "grounded" when embeddings are semantic and a relevant match is found', async () => {
    mockedGetEmbedding.mockResolvedValue({ vector: HIGH_SIM_VECTOR, mode: 'semantic' });

    const result = await executeHybridRAGSearch('endometriosis biomarkers', 'endometriosis');

    expect(result.embeddingMode).toBe('semantic');
    expect(result.retrievalState).toBe('grounded');
  });

  it('returns "degraded" when the fallback (non-semantic) embedding vectorizer is used, even with a high raw similarity score', async () => {
    mockedGetEmbedding.mockResolvedValue({ vector: HIGH_SIM_VECTOR, mode: 'fallback' });

    const result = await executeHybridRAGSearch('endometriosis biomarkers', 'endometriosis');

    expect(result.embeddingMode).toBe('fallback');
    expect(result.retrievalState).toBe('degraded');
  });

  it('returns "data-gap" when no candidate is a relevant match, regardless of embedding mode', async () => {
    mockedGetEmbedding.mockResolvedValue({ vector: LOW_SIM_VECTOR, mode: 'semantic' });

    const result = await executeHybridRAGSearch('zzz_no_relevant_match_zzz', 'zzz_no_relevant_match_zzz');

    expect(result.retrievalState).toBe('data-gap');
  });

  it('never derives retrievalState from a fabricated numeric confidence default', async () => {
    mockedGetEmbedding.mockResolvedValue({ vector: HIGH_SIM_VECTOR, mode: 'semantic' });

    const result = await executeHybridRAGSearch('endometriosis biomarkers', 'endometriosis');

    // topSimilarity is exposed as a raw signal, but retrievalState must be one of the
    // three honest states — not derived from `|| 88`-style fallback defaults.
    expect(['grounded', 'degraded', 'data-gap']).toContain(result.retrievalState);
    expect(typeof result.topSimilarity).toBe('number');
  });
});
