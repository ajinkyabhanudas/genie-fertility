import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';

// Mocks the GoogleGenAI SDK and the Postgres pool entirely — this test makes
// zero network requests, zero live model calls, and touches no real database,
// per project policy (fixture/mock-only testing, no live API spend). The
// proxy process itself is started once per test on an ephemeral port and hit
// over real HTTP so the express wiring (routing, auth, rate-limit middleware)
// is exercised, not just the handlers.
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

// In-memory stand-in for the generation_cache + audit_log tables so route
// logic (cache lookup, transactional audit write) is exercised without a
// real database. Each test gets a fresh cache via vi.resetModules().
let generationCache: Map<string, string>;
let auditRowCount: number;
let failNextAuditInsert: boolean;
let retrieveSparseRows: { id: string; score: number }[];
let retrieveDenseRows: { id: string; similarity: number }[];
let retrieveChunkRows: any[];

const mockClient = {
  query: vi.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT response_text FROM generation_cache')) {
      const key = params?.[0];
      const cached = generationCache.get(key);
      return { rows: cached ? [{ response_text: cached }] : [] };
    }
    if (sql.includes('SELECT row_hash FROM audit_log')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      if (failNextAuditInsert) {
        failNextAuditInsert = false;
        throw new Error('simulated audit_log insert failure (e.g. constraint violation)');
      }
      auditRowCount += 1;
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO generation_cache')) {
      const [key, text] = params ?? [];
      generationCache.set(key, text);
      return { rows: [] };
    }
    if (sql.includes('ts_rank_cd')) {
      return { rows: retrieveSparseRows };
    }
    if (sql.includes('embedding <=>') && sql.includes('ORDER BY')) {
      return { rows: retrieveDenseRows };
    }
    if (sql.includes('FROM document_chunks') && sql.includes('WHERE id = ANY')) {
      const ids: string[] = params?.[0] ?? [];
      return { rows: retrieveChunkRows.filter((row) => ids.includes(row.id)) };
    }
    // BEGIN / COMMIT / ROLLBACK
    return { rows: [] };
  }),
  release: vi.fn(),
};

vi.mock('./db/pool', () => ({
  pool: {
    connect: vi.fn(async () => mockClient),
    query: vi.fn(async () => ({ rows: [] })),
  },
}));

describe('proxy server', () => {
  let server: Server;
  let baseUrl: string;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer test-auth-token' };

  beforeEach(async () => {
    vi.resetModules();
    mockEmbedContent.mockReset();
    mockGenerateContent.mockReset();
    mockClient.query.mockClear();
    generationCache = new Map();
    auditRowCount = 0;
    failNextAuditInsert = false;
    retrieveSparseRows = [];
    retrieveDenseRows = [];
    retrieveChunkRows = [];
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.AUTH_TOKEN = 'test-auth-token';
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
    delete process.env.AUTH_TOKEN;
    delete process.env.PROXY_PORT;
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    });

    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid bearer token with 401', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ prompt: 'hello' }),
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/embed returns a semantic vector on success', async () => {
    mockEmbedContent.mockResolvedValue({ embedding: { values: [0.1, 0.2, 0.3] } });

    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ text: 'hello' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vector).toEqual([0.1, 0.2, 0.3]);
  });

  it('POST /api/embed returns 400 when text is missing', async () => {
    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/embed returns 503 without leaking internals when upstream throws', async () => {
    mockEmbedContent.mockRejectedValue(new Error('some internal upstream detail'));

    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ text: 'hello' }),
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('some internal upstream detail');
  });

  it('POST /api/generate returns text on success and writes one audit row', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Generated output' });

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ prompt: 'hello' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('Generated output');
    expect(auditRowCount).toBe(1);
  });

  it('returns 500 and leaks no result text when the audit write fails mid-transaction', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'should never reach the client' });
    failNextAuditInsert = true;

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ prompt: 'audit will fail for this one' }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('should never reach the client');
    expect(auditRowCount).toBe(0); // rollback means no partial audit row either
  });

  it('POST /api/generate returns 400 when prompt is missing', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/generate serves a cache hit without calling the provider or writing a new audit row', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'first response' });

    const first = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ prompt: 'same prompt', query: 'q', country: 'UK', adjacency: 'RIF' }),
    });
    expect(first.status).toBe(200);
    expect(auditRowCount).toBe(1);

    mockGenerateContent.mockClear();

    const second = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ prompt: 'same prompt', query: 'q', country: 'UK', adjacency: 'RIF' }),
    });
    const body = await second.json();

    expect(second.status).toBe(200);
    expect(body.cacheHit).toBe(true);
    expect(body.text).toBe('first response');
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(auditRowCount).toBe(1); // no new row for the cache hit
  });

  it('POST /api/retrieve returns fused chunks on success', async () => {
    mockEmbedContent.mockResolvedValue({ embedding: { values: new Array(768).fill(0.1) } });
    retrieveSparseRows = [{ id: 'chunk-1', score: 0.8 }];
    retrieveDenseRows = [{ id: 'chunk-1', similarity: 0.9 }];
    retrieveChunkRows = [
      {
        id: 'chunk-1',
        ref_tag: '[REF-1]',
        title: 'Test Title',
        abstract: 'Test abstract',
        text: 'Test body',
        source: 'static_corpus',
        source_name: 'Test Source',
        url: null,
        doi: null,
        pmid: null,
        nct_id: null,
        publication_date: null,
        authors: null,
      },
    ];

    const res = await fetch(`${baseUrl}/api/retrieve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ query: 'recurrent implantation failure' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.degraded).toBe(false);
    expect(body.chunks).toHaveLength(1);
    expect(body.chunks[0].id).toBe('chunk-1');
  });

  it('POST /api/retrieve returns 400 when query is missing', async () => {
    const res = await fetch(`${baseUrl}/api/retrieve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/retrieve returns 503 when no API key is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    vi.resetModules();
    const mod = await import('./index');
    await new Promise<void>((resolve) => mod.server.once('listening', resolve));
    const address = mod.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const noKeyUrl = `http://127.0.0.1:${port}`;

    const res = await fetch(`${noKeyUrl}/api/retrieve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ query: 'test' }),
    });

    expect(res.status).toBe(503);
    await new Promise<void>((resolve) => mod.server.close(() => resolve()));
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('POST /api/retrieve degrades gracefully when dense search fails, sparse still succeeds', async () => {
    retrieveSparseRows = [{ id: 'chunk-1', score: 0.7 }];
    retrieveChunkRows = [
      {
        id: 'chunk-1',
        ref_tag: '[REF-1]',
        title: 'Test Title',
        abstract: null,
        text: 'Test body',
        source: 'static_corpus',
        source_name: 'Test Source',
        url: null,
        doi: null,
        pmid: null,
        nct_id: null,
        publication_date: null,
        authors: null,
      },
    ];
    mockEmbedContent.mockRejectedValue(new Error('embedding upstream failure'));

    const res = await fetch(`${baseUrl}/api/retrieve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ query: 'test query' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.degraded).toBe(true);
    expect(body.chunks).toHaveLength(1);
  });

  it('rate-limits after the configured max requests per window', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'ok' });

    const requests = Array.from({ length: 32 }, (_, i) =>
      fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ prompt: `x-${i}` }), // distinct prompts avoid the cache path
      })
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(30);
  });
});
