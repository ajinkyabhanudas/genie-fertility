import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from './rateLimit';

function mockReqRes(ip: string) {
  const req = { ip } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the max within the window', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const { req, res, next } = mockReqRes('1.1.1.1');

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects with 429 once the max is exceeded within the window', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const { req, res, next } = mockReqRes('2.2.2.2');

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('tracks distinct IPs independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const a = mockReqRes('3.3.3.3');
    const b = mockReqRes('4.4.4.4');

    limiter(a.req, a.res, a.next);
    limiter(b.req, b.res, b.next);

    expect(a.next).toHaveBeenCalledTimes(1);
    expect(b.next).toHaveBeenCalledTimes(1);
    expect(a.res.status).not.toHaveBeenCalled();
    expect(b.res.status).not.toHaveBeenCalled();
  });

  it('resets the count once the window elapses', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    const { req, res, next } = mockReqRes('5.5.5.5');

    limiter(req, res, next);
    vi.advanceTimersByTime(1001);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('prunes expired entries so tracked IP count does not grow unbounded', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 5 });

    for (let i = 0; i < 50; i++) {
      const { req, res, next } = mockReqRes(`10.0.0.${i}`);
      limiter(req, res, next);
    }

    vi.advanceTimersByTime(1001);

    // One more request from a new IP triggers the prune sweep.
    const { req, res, next } = mockReqRes('10.0.0.99');
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
