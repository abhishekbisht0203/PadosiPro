import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { config } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/routes.js';
import { profileRouter } from './modules/profile/routes.js';
import { tasksRouter } from './modules/tasks/routes.js';
import { CATALOGUE } from './db/catalogue.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      // The API serves JSON only; a restrictive CSP is set by the CDN that
      // hosts the web app, not here.
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  // Cheap liveness probe used by the Dockerfile healthcheck and docker compose.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'padosipro-api', time: new Date().toISOString() });
  });

  app.get('/api/meta', (_req, res) => {
    res.json({
      data: {
        categories: CATALOGUE.length,
        tasks: CATALOGUE.reduce((total, c) => total + c.tasks.length, 0),
        otp: { length: config.OTP_LENGTH, ttlMinutes: config.OTP_TTL_MINUTES },
      },
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/tasks', tasksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
