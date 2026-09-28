import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildCorsOptions, createApp } from '../app.js';

/**
 * Regression cover for a bug found while running the app against a real
 * browser: `cors({ origin: '*', credentials: true })` makes the middleware send
 * `Access-Control-Allow-Origin: *` together with
 * `Access-Control-Allow-Credentials: true`. Browsers reject that combination,
 * so every cross-origin call failed as a network error even though the API was
 * returning perfectly good responses.
 */
const app = createApp();

describe('CORS', () => {
  it('reflects the caller origin instead of sending a wildcard with credentials', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:8099')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization')
      .expect(204);

    const allowOrigin = res.headers['access-control-allow-origin'];
    expect(allowOrigin).toBe('http://localhost:8099');
    expect(allowOrigin).not.toBe('*');
  });

  it('answers the preflight for a request that carries a JSON body', async () => {
    await request(app)
      .options('/api/auth/register')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
  });

  it('sets an allow-origin header on real responses too', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:8099').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8099');
  });

  it('never pairs a wildcard origin with credentials', () => {
    const options = buildCorsOptions();
    // The invariant that actually matters to a browser. In "any origin" mode we
    // reflect the caller (`origin: true`) and leave credentials off, which is
    // both valid and sufficient — the mobile app authenticates with a bearer
    // token, not a cookie.
    expect(options.origin === '*' && options.credentials === true).toBe(false);
  });

  it('reflects rather than wildcards when configured for any origin', () => {
    const options = buildCorsOptions();
    expect(options.origin).toBe(true);
    expect(options.credentials).toBe(false);
  });
});
