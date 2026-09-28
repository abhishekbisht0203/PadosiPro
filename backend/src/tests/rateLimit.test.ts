import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../middleware/errorHandler.js';

/**
 * The functional suite raises the real limits so it is not throttled, which
 * means the limiter would otherwise go untested. This covers it directly with a
 * deliberately tiny budget: if someone later removes the limiter from the auth
 * routes, this is what fails.
 */
function appWithLimit(limit: number) {
  const app = express();
  app.use(express.json());
  app.post(
    '/login',
    rateLimit({
      windowMs: 60_000,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute and try again.' } },
    }),
    (_req, res) => {
      res.json({ data: { ok: true } });
    },
  );
  app.use(errorHandler);
  return app;
}

describe('credential rate limiting', () => {
  it('allows requests up to the budget, then answers 429 with the standard envelope', async () => {
    const app = appWithLimit(3);

    for (let i = 0; i < 3; i++) {
      await request(app).post('/login').send({}).expect(200);
    }

    const blocked = await request(app).post('/login').send({}).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toContain('wait a minute');
    // The mobile app can read this header to show a countdown instead of a
    // dead end.
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
