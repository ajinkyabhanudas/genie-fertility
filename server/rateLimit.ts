/**
 * @file rateLimit.ts
 * @description Minimal in-memory fixed-window rate limiter. No external store —
 * this process is the only instance (single-server deployment), so in-memory
 * state is sufficient and avoids adding a Redis dependency for one counter.
 */

import type { Request, Response, NextFunction } from 'express';

interface WindowState {
  count: number;
  windowStart: number;
}

export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, WindowState>();

  // Sweeps expired entries so `hits` doesn't grow unbounded over a
  // long-running process lifetime as new client IPs are seen.
  function pruneExpired(now: number) {
    for (const [key, state] of hits) {
      if (now - state.windowStart >= opts.windowMs) {
        hits.delete(key);
      }
    }
  }

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const state = hits.get(key);

    if (!state || now - state.windowStart >= opts.windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      pruneExpired(now);
      return next();
    }

    if (state.count >= opts.max) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again shortly.' });
      return;
    }

    state.count += 1;
    next();
  };
}
