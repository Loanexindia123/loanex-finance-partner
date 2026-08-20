import crypto from 'node:crypto';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';

export interface AccessTokenPayload {
  sub: string;
  uuid: string;
  email: string;
  mobile: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  uuid: string;
  type: 'refresh';
  jti: string;
}

export interface RegistrationTokenPayload {
  mobile: string;
  type: 'registration';
}

export interface OtpChallengePayload {
  type: 'otp_challenge';
  mobile: string;
  purpose: string;
  otpHash: string;
  attempts: number;
  resendCount: number;
  lastSentAt: number;
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, 'type'>,
  expiresIn: string = env.JWT_ACCESS_EXPIRES_IN,
): string {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_ACCESS_SECRET as Secret,
    options,
  );
}

export function signRefreshToken(
  payload: Omit<RefreshTokenPayload, 'type' | 'jti'>,
  jti = crypto.randomUUID(),
): { token: string; jti: string } {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  };

  const token = jwt.sign(
    { ...payload, type: 'refresh', jti },
    env.JWT_REFRESH_SECRET as Secret,
    options,
  );

  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid access token type');
  }
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET as Secret) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  return payload;
}

/** Short-lived token proving mobile OTP was verified before profile completion. */
export function signRegistrationToken(mobile: string): string {
  const options: SignOptions = { expiresIn: '30m' };
  return jwt.sign(
    { mobile, type: 'registration' } satisfies RegistrationTokenPayload,
    env.JWT_ACCESS_SECRET as Secret,
    options,
  );
}

export function verifyRegistrationToken(token: string): RegistrationTokenPayload {
  const payload = jwt.verify(
    token,
    env.JWT_ACCESS_SECRET as Secret,
  ) as RegistrationTokenPayload;
  if (payload.type !== 'registration' || !payload.mobile) {
    throw new Error('Invalid registration token');
  }
  return payload;
}

export function signOtpChallenge(
  payload: Omit<OtpChallengePayload, 'type'>,
  expiresIn = `${env.OTP_EXPIRES_MINUTES}m`,
): string {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(
    { ...payload, type: 'otp_challenge' } satisfies OtpChallengePayload,
    env.JWT_ACCESS_SECRET as Secret,
    options,
  );
}

export function verifyOtpChallenge(token: string): OtpChallengePayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as OtpChallengePayload;
  if (payload.type !== 'otp_challenge' || !payload.mobile || !payload.otpHash) {
    throw new Error('Invalid OTP challenge');
  }
  return payload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getRefreshExpiryDate(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN.trim());
  const now = Date.now();

  if (!match) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(now + amount * multipliers[unit]);
}
