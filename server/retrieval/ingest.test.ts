import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestChunks, type IngestChunkInput } from './ingest';

// In-memory stand-in for document_chunks — mirrors the mock pattern in
// server/index.test.ts. No real Postgres, no real embedding calls.
let rows: Map<string, { content_hash: string }>;
let embedCallCount: number;

const mockClient = {
  query: vi.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT content_hash FROM document_chunks')) {
      const id = params?.[0];
      const row = rows.get(id);
      return { rows: row ? [row] : [] };
    }
    if (sql.includes('INSERT INTO document_chunks')) {
      const [id, , , , , , , , , , , , , , contentHash] = params ?? [];
      rows.set(id, { content_hash: contentHash });
      return { rows: [] };
    }
    return { rows: [] };
  }),
  release: vi.fn(),
};

const mockPool = {
  connect: vi.fn(async () => mockClient),
} as any;

const mockAi = {
  models: {
    embedContent: vi.fn(async () => {
      embedCallCount += 1;
      return { embedding: { values: new Array(768).fill(0.1) } };
    }),
  },
} as any;

function makeChunk(overrides: Partial<IngestChunkInput> = {}): IngestChunkInput {
  return {
    id: 'chunk-1',
    refTag: '[REF-1]',
    title: 'Test title',
    abstract: 'Test abstract',
    text: 'Test body text',
    source: 'static_corpus',
    sourceName: 'Test Source',
    ...overrides,
  };
}

beforeEach(() => {
  rows = new Map();
  embedCallCount = 0;
  mockClient.query.mockClear();
  mockAi.models.embedContent.mockClear();
});

describe('ingestChunks', () => {
  it('embeds a new chunk exactly once', async () => {
    const summary = await ingestChunks([makeChunk()], { pool: mockPool, ai: mockAi });

    expect(summary.embedded).toBe(1);
    expect(summary.skippedUnchanged).toBe(0);
    expect(summary.failed).toBe(0);
    expect(embedCallCount).toBe(1);
  });

  it('makes zero embed calls when re-ingesting an unchanged chunk', async () => {
    await ingestChunks([makeChunk()], { pool: mockPool, ai: mockAi });
    expect(embedCallCount).toBe(1);

    const summary = await ingestChunks([makeChunk()], { pool: mockPool, ai: mockAi });

    expect(embedCallCount).toBe(1); // hard gate: no new embed call on unchanged re-ingest
    expect(summary.embedded).toBe(0);
    expect(summary.skippedUnchanged).toBe(1);
  });

  it('re-embeds when chunk content changes', async () => {
    await ingestChunks([makeChunk()], { pool: mockPool, ai: mockAi });
    expect(embedCallCount).toBe(1);

    const summary = await ingestChunks(
      [makeChunk({ text: 'Different body text' })],
      { pool: mockPool, ai: mockAi }
    );

    expect(embedCallCount).toBe(2);
    expect(summary.embedded).toBe(1);
    expect(summary.skippedUnchanged).toBe(0);
  });

  it('isolates a failed embed call — batch continues, other chunks still ingest', async () => {
    mockAi.models.embedContent
      .mockImplementationOnce(async () => {
        embedCallCount += 1;
        throw new Error('upstream error');
      })
      .mockImplementationOnce(async () => {
        embedCallCount += 1;
        return { embedding: { values: new Array(768).fill(0.1) } };
      });

    const summary = await ingestChunks(
      [makeChunk({ id: 'chunk-fail' }), makeChunk({ id: 'chunk-ok' })],
      { pool: mockPool, ai: mockAi }
    );

    expect(summary.failed).toBe(1);
    expect(summary.embedded).toBe(1);
    expect(summary.total).toBe(2);
  });

  it('isolates a failed insert — batch continues, other chunks still ingest', async () => {
    mockClient.query.mockImplementationOnce(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT content_hash FROM document_chunks')) return { rows: [] };
      return { rows: [] };
    });
    let insertCalls = 0;
    const originalQuery = mockClient.query.getMockImplementation()!;
    mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO document_chunks')) {
        insertCalls += 1;
        if (insertCalls === 1) throw new Error('simulated constraint violation');
      }
      return originalQuery(sql, params);
    });

    const summary = await ingestChunks(
      [makeChunk({ id: 'chunk-bad-insert' }), makeChunk({ id: 'chunk-good-insert' })],
      { pool: mockPool, ai: mockAi }
    );

    expect(summary.failed).toBe(1);
    expect(summary.embedded).toBe(1);
    expect(summary.total).toBe(2);
  });

  it('reports total matching input batch size', async () => {
    const summary = await ingestChunks(
      [makeChunk({ id: 'a' }), makeChunk({ id: 'b' }), makeChunk({ id: 'c' })],
      { pool: mockPool, ai: mockAi }
    );

    expect(summary.total).toBe(3);
    expect(summary.embedded).toBe(3);
  });
});
