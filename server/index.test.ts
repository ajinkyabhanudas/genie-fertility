import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';

// Mocks the GoogleGenAI SDK entirely — this test makes zero network requests
// and zero live model calls, per project policy (fixture/mock-only testing,
// no live API spend). The proxy process itself is started once per test file
// on an ephemeral port and hit over real HTTP so the express wiring (routing,
// json body parsing, rate-limit middleware) is exercised, not just the handlers.
const mockEmbedContent = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function (this: any) {
    this.models = {
      embedContent: mockEmbedContent,
      generateContent: mockGenerateContent,
    };
  }),
}));

describe('proxy server', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.resetModules();
    mockEmbedContent.mockReset();
    mockGenerateContent.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.PROXY_PORT = '0';

    const mod = await import('./index');
    server = mod.server;

    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.GEMINI_API_KEY;
    delete process.env.PROXY_PORT;
  });

  it('POST /api/embed returns a semantic vector on success', async () => {
    mockEmbedContent.mockResolvedValue({ embedding: { values: [0.1, 0.2, 0.3] } });

    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vector).toEqual([0.1, 0.2, 0.3]);
  });

  it('POST /api/embed returns 400 when text is missing', async () => {
    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/embed returns 503 without leaking internals when upstream throws', async () => {
    mockEmbedContent.mockRejectedValue(new Error('some internal upstream detail'));

    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('some internal upstream detail');
  });

  it('POST /api/generate returns text on success', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Generated output' });

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('Generated output');
  });

  it('POST /api/generate returns 400 when prompt is missing', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('rate-limits after the configured max requests per window', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'ok' });

    const requests = Array.from({ length: 32 }, () =>
      fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'x' }),
      })
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(30);
  });
});
