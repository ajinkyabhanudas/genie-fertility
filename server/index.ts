/**
 * @file index.ts
 * @description Backend proxy for Gemini API calls. GEMINI_API_KEY never leaves
 * this process. /api/generate is audited (hash-chained, transactional) and
 * cached for idempotency; /api/embed is a pure vector transform with no
 * generation semantics, so it gets auth + rate-limiting but no audit row.
 */

import crypto from 'crypto';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createRateLimiter } from './rateLimit';
import { requireAuth } from './auth';
import { pool } from './db/pool';
import { writeAuditEntry } from './audit/auditLog';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api', requireAuth);

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const rateLimit = createRateLimiter({ windowMs: 60_000, max: 30 });

function logOutcome(endpoint: string, startedAt: number, outcome: 'success' | 'fallback' | 'error') {
  const latencyMs = Date.now() - startedAt;
  console.log(JSON.stringify({ endpoint, latencyMs, outcome, ts: new Date().toISOString() }));
}

const GENERATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function generationCacheKey(query: string, country: string, adjacency: string, model: string, promptHash: string): string {
  return crypto.createHash('sha256').update(`${query}|${country}|${adjacency}|${model}|${promptHash}`).digest('hex');
}

app.post('/api/embed', rateLimit, async (req, res) => {
  const startedAt = Date.now();
  const { text } = req.body ?? {};

  if (typeof text !== 'string' || text.length === 0) {
    res.status(400).json({ error: 'text (string) is required' });
    return;
  }

  if (!ai) {
    logOutcome('embed', startedAt, 'fallback');
    res.status(503).json({ error: 'embedding_unavailable', reason: 'no_api_key' });
    return;
  }

  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text.slice(0, 2048),
    });

    const result = response as any;
    const vector = result.embedding?.values ?? result.embeddings?.[0]?.values;

    if (!vector) {
      logOutcome('embed', startedAt, 'fallback');
      res.status(503).json({ error: 'embedding_unavailable', reason: 'empty_response' });
      return;
    }

    logOutcome('embed', startedAt, 'success');
    res.json({ vector });
  } catch (error) {
    logOutcome('embed', startedAt, 'error');
    res.status(503).json({ error: 'embedding_unavailable', reason: 'upstream_error' });
  }
});

app.post('/api/generate', rateLimit, async (req, res) => {
  const startedAt = Date.now();
  const { prompt, model, query, country, adjacency } = req.body ?? {};

  if (typeof prompt !== 'string' || prompt.length === 0) {
    res.status(400).json({ error: 'prompt (string) is required' });
    return;
  }

  if (!ai) {
    logOutcome('generate', startedAt, 'error');
    res.status(503).json({ error: 'generation_unavailable', reason: 'no_api_key' });
    return;
  }

  const resolvedModel = model || 'gemini-3-flash-preview';
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
  const cacheKey = generationCacheKey(query || prompt, country || '', adjacency || '', resolvedModel, promptHash);

  const client = await pool.connect();
  try {
    const cached = await client.query(
      'SELECT response_text FROM generation_cache WHERE cache_key = $1 AND expires_at > now()',
      [cacheKey]
    );

    if (cached.rows.length > 0) {
      logOutcome('generate', startedAt, 'success');
      res.json({ text: cached.rows[0].response_text, cacheHit: true });
      return;
    }

    const response = await ai.models.generateContent({ model: resolvedModel, contents: prompt });
    const text = response.text || '';
    const outputHash = crypto.createHash('sha256').update(text).digest('hex');

    await client.query('BEGIN');
    try {
      await writeAuditEntry(client, {
        who: req.header('x-client-id') || 'unknown',
        query: query || prompt,
        country,
        adjacency,
        retrievedChunks: [],
        model: resolvedModel,
        promptHash,
        outputHash,
        retrievalState: 'unknown',
        embeddingMode: 'unknown',
        outcome: 'success',
      });

      await client.query(
        `INSERT INTO generation_cache (cache_key, response_text, expires_at)
         VALUES ($1, $2, now() + interval '${GENERATION_CACHE_TTL_MS} milliseconds')
         ON CONFLICT (cache_key) DO NOTHING`,
        [cacheKey, text]
      );

      await client.query('COMMIT');
    } catch (auditError) {
      await client.query('ROLLBACK');
      // No result without a record — an audit write failure must not let a
      // generation reach the client.
      logOutcome('generate', startedAt, 'error');
      res.status(500).json({ error: 'generation_unavailable', reason: 'audit_write_failed' });
      return;
    }

    logOutcome('generate', startedAt, 'success');
    res.json({ text });
  } catch (error) {
    logOutcome('generate', startedAt, 'error');
    res.status(503).json({ error: 'generation_unavailable', reason: 'upstream_error' });
  } finally {
    client.release();
  }
});

const PORT = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 8787;
export const server = app.listen(PORT, () => {
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : PORT;
  console.log(`Gemini proxy listening on :${boundPort} (key configured: ${Boolean(apiKey)})`);
});
