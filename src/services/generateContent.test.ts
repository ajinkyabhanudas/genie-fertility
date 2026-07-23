import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContent } from './generateContent';

// Mocks global fetch — this test makes zero network requests and zero live
// model calls, per project policy (fixture/mock-only testing, no live API spend).
describe('generateContent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns text from a successful proxy response', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Generated output' }),
    });

    const result = await generateContent('some prompt');

    expect(result).toBe('Generated output');
    expect(fetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ prompt: 'some prompt', model: undefined }),
    }));
  });

  it('returns empty string when response has no text field', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const result = await generateContent('some prompt');
    expect(result).toBe('');
  });

  it('throws with the server error message when the proxy returns a non-ok response', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'generation_unavailable' }),
    });

    await expect(generateContent('some prompt')).rejects.toThrow('generation_unavailable');
  });

  it('throws a fallback message when the error response body is not JSON', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    });

    await expect(generateContent('some prompt')).rejects.toThrow('Generation request failed (500)');
  });
});
