import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTokenizerCall = vi.fn();
const mockModelCall = vi.fn();
const mockFromPretrainedTokenizer = vi.fn(async (_modelId?: string) => mockTokenizerCall);
const mockFromPretrainedModel = vi.fn(async (_modelId?: string) => mockModelCall);

vi.mock('@huggingface/transformers', () => ({
  AutoTokenizer: { from_pretrained: (modelId: string) => mockFromPretrainedTokenizer(modelId) },
  AutoModelForSequenceClassification: { from_pretrained: (modelId: string) => mockFromPretrainedModel(modelId) },
}));

async function importFreshRerank() {
  vi.resetModules();
  return import('./rerank');
}

beforeEach(() => {
  mockTokenizerCall.mockReset();
  mockModelCall.mockReset();
  mockFromPretrainedTokenizer.mockReset();
  mockFromPretrainedModel.mockReset();
  mockTokenizerCall.mockImplementation(async () => ({ input_ids: [], attention_mask: [] }));
  mockFromPretrainedTokenizer.mockImplementation(async () => mockTokenizerCall);
  mockFromPretrainedModel.mockImplementation(async () => mockModelCall);
});

describe('rerank', () => {
  it('returns empty array for empty candidate list without loading the model', async () => {
    const { rerank } = await importFreshRerank();

    const result = await rerank('query', []);

    expect(result).toEqual([]);
    expect(mockFromPretrainedModel).not.toHaveBeenCalled();
  });

  it('scores candidates and returns them ordered by score descending', async () => {
    const { rerank } = await importFreshRerank();
    mockModelCall.mockImplementation(async (inputs: any) => {
      // encode the expected score into a fake logits array based on call order
      return { logits: { data: [mockModelCall.mock.calls.length === 1 ? 0.2 : 0.9] } };
    });

    const result = await rerank('query', [
      { id: 'low', text: 'less relevant text' },
      { id: 'high', text: 'more relevant text' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('high');
    expect(result[0].rerankScore).toBe(0.9);
    expect(result[1].id).toBe('low');
  });

  it('loads the model exactly once across multiple rerank calls (module-level singleton)', async () => {
    const { rerank } = await importFreshRerank();
    mockModelCall.mockResolvedValue({ logits: { data: [0.5] } });

    await rerank('query 1', [{ id: 'a', text: 'text a' }]);
    await rerank('query 2', [{ id: 'b', text: 'text b' }]);

    expect(mockFromPretrainedModel).toHaveBeenCalledTimes(1);
    expect(mockFromPretrainedTokenizer).toHaveBeenCalledTimes(1);
  });

  it('propagates model load failure to the caller', async () => {
    mockFromPretrainedModel.mockRejectedValue(new Error('model load failed'));
    const { rerank } = await importFreshRerank();

    await expect(rerank('query', [{ id: 'a', text: 'text' }])).rejects.toThrow('model load failed');
  });

  it('retries model load on the next call after a failure, does not permanently poison the singleton', async () => {
    const { rerank } = await importFreshRerank();
    mockFromPretrainedModel.mockRejectedValueOnce(new Error('transient load failure'));

    await expect(rerank('query', [{ id: 'a', text: 'text' }])).rejects.toThrow('transient load failure');

    mockFromPretrainedModel.mockResolvedValueOnce(mockModelCall);
    mockModelCall.mockResolvedValue({ logits: { data: [0.7] } });

    const result = await rerank('query', [{ id: 'a', text: 'text' }]);

    expect(result).toEqual([{ id: 'a', rerankScore: 0.7 }]);
    expect(mockFromPretrainedModel).toHaveBeenCalledTimes(2); // retried, not cached-rejected
  });

  it('propagates inference failure to the caller', async () => {
    const { rerank } = await importFreshRerank();
    mockModelCall.mockRejectedValue(new Error('inference failed'));

    await expect(rerank('query', [{ id: 'a', text: 'text' }])).rejects.toThrow('inference failed');
  });
});
