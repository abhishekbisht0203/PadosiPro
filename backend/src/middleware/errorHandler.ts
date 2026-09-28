import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError, notFound } from '../lib/errors.js';
import { config } from '../env.js';

/** JSON body parser guard: a malformed body should read as a 400, not a 500. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(notFound('ROUTE_NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(err)) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        ...(err.meta ? { meta: err.meta } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      if (!details[key]) details[key] = issue.message;
    }
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', details },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
    });
    return;
  }

  // Postgres unique violation that slipped past an explicit check.
  if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'That record already exists.' },
    });
    return;
  }

  console.error('[error] unhandled', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      // Never leak internals in production, but do surface the message in dev
      // so the flow can be debugged without reading server logs.
      ...(config.isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}

export { AppError };
