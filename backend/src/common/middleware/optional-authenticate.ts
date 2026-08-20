import { NextFunction, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import type { AuthenticatedRequest } from './authenticate';

export function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    req.user = verifyAccessToken(token);
    req.authFailed = false;
  } catch {
    // Caller sent a Bearer token but it is invalid/expired.
    // Do NOT silently treat as anonymous — product list would leak the public catalog.
    req.user = undefined;
    req.authFailed = true;
  }

  next();
}
