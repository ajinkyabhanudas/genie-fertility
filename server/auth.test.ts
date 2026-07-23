import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireAuth } from './auth';

function mockReqRes(authHeader?: string) {
  const req = { header: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : undefined) } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  afterEach(() => {
    delete process.env.AUTH_TOKEN;
  });

  it('fails closed with 401 when AUTH_TOKEN is not configured', () => {
    delete process.env.AUTH_TOKEN;
    const { req, res, next } = mockReqRes('Bearer anything');

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a missing Authorization header with 401', () => {
    process.env.AUTH_TOKEN = 'secret';
    const { req, res, next } = mockReqRes(undefined);

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a non-Bearer scheme with 401', () => {
    process.env.AUTH_TOKEN = 'secret';
    const { req, res, next } = mockReqRes('Basic secret');

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an incorrect token with 401', () => {
    process.env.AUTH_TOKEN = 'secret';
    const { req, res, next } = mockReqRes('Bearer wrong');

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a correct bearer token', () => {
    process.env.AUTH_TOKEN = 'secret';
    const { req, res, next } = mockReqRes('Bearer secret');

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
