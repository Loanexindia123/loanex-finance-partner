import { NextFunction, Request, Response } from 'express';
import { jsonDb } from '../../config/json-db';

/**
 * Wait for deferred (non-catalog) Mongo hydration before handling the request.
 * Catalog routes must NOT use this — they only need jsonDb.ready.
 */
export async function awaitDeferredHydration(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // GET /verification/status uses targeted Mongo lookups and must not wait
    // for the full deferred hydrate (often 7–16s after boot).
    const url = (req.originalUrl || req.path || '').split('?')[0];
    if (req.method === 'GET' && /\/verification\/status\/?$/.test(url)) {
      next();
      return;
    }
    await jsonDb.deferredReady;
    next();
  } catch (err) {
    next(err);
  }
}
