import { NextFunction, Request, Response } from 'express';
import { jsonDb } from '../../config/json-db';

/**
 * Wait for deferred (non-catalog) Mongo hydration before handling the request.
 * Catalog routes must NOT use this — they only need jsonDb.ready.
 */
export async function awaitDeferredHydration(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await jsonDb.deferredReady;
    next();
  } catch (err) {
    next(err);
  }
}
