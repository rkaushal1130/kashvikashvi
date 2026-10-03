import { createHash } from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtAccessPayload, JwtRefreshPayload } from '../types';

export function signAccessToken(payload: Omit<JwtAccessPayload, 'iat' | 'exp'>): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: Omit<JwtRefreshPayload, 'iat' | 'exp'>): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
