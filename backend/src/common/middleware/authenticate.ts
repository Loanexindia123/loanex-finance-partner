import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/app-error';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
  /** Set by optionalAuthenticate when a Bearer token was sent but failed verification. */
  authFailed?: boolean;
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Access token is required'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    console.error('[AUTH-DEBUG] verify failed:', (err as Error).message);
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}
