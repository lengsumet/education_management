import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  // Fail loudly in production rather than silently signing with a known key.
  throw new Error('JWT_SECRET is not set. Refusing to start with an insecure default.');
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me'
);

export interface SessionPayload extends JWTPayload {
  userId: number;
  role: 'student' | 'teacher' | 'admin';
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function signToken(
  payload: SessionPayload,
  expiresIn: string = '1d'
): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
  return token;
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Cryptographically secure 6-char reset token (A-Z, 0-9).
 * The original used Math.random(), which is predictable and unsafe for
 * anything security-relevant. The DB column is VarChar(6), so we keep 6 chars.
 */
export function generateResetToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
