/**
 * @file auth.ts
 * @description Single-tenant bearer token auth middleware. Interim scheme for
 * an internal clinical tool (SP-2 scope explicitly excludes multi-tenant IAM
 * this phase) — structured so a session/SSO scheme can replace it later
 * without route changes.
 */

import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.AUTH_TOKEN;

  if (!expected) {
    // No token configured: fail closed, not open. An internal clinical tool
    // must never silently allow all requests because setup was incomplete.
    res.status(401).json({ error: 'unauthorized', reason: 'auth_not_configured' });
    return;
  }

  const header = req.header('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || token !== expected) {
    res.status(401).json({ error: 'unauthorized', reason: 'invalid_or_missing_token' });
    return;
  }

  next();
}
