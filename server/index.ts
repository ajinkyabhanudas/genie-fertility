/**
 * @file index.ts
 * @description Backend proxy for Gemini API calls. GEMINI_API_KEY never leaves
 * this process — the client calls these two endpoints instead of the GenAI SDK
 * directly. No request/response content is logged (may contain clinical/market
 * query text); only timing and outcome are recorded.
 */

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createRateLimiter } from './rateLimit';

const app = express();
app.use(express.json({ limit: '1mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const rateLimit = createRateLimiter({ windowMs: 60_000, max: 30 });

function logOutcome(endpoint: string, startedAt: number, outcome: 'success' | 'fallback' | 'error') {
  const latencyMs = Date.now() - startedAt;
  console.log(JSON.stringify({ endpoint, latencyMs, outcome, ts: new Date().toISOString() }));
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
  const { prompt, model } = req.body ?? {};

  if (typeof prompt !== 'string' || prompt.length === 0) {
    res.status(400).json({ error: 'prompt (string) is required' });
    return;
  }

  if (!ai) {
    logOutcome('generate', startedAt, 'error');
    res.status(503).json({ error: 'generation_unavailable', reason: 'no_api_key' });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents: prompt,
    });

    logOutcome('generate', startedAt, 'success');
    res.json({ text: response.text || '' });
  } catch (error) {
    logOutcome('generate', startedAt, 'error');
    res.status(503).json({ error: 'generation_unavailable', reason: 'upstream_error' });
  }
});

const PORT = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 8787;
export const server = app.listen(PORT, () => {
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : PORT;
  console.log(`Gemini proxy listening on :${boundPort} (key configured: ${Boolean(apiKey)})`);
});
