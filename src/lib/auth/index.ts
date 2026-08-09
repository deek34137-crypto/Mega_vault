import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'megavault_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      '[MegaVault] COOKIE_SECRET env var is missing or too short (min 32 chars). Set it in your Render environment variables.'
    );
  }
  return new TextEncoder().encode(secret);
}

export function verifyPassword(password: string): boolean {
  const expectedPassword = process.env.SITE_PASSWORD;
  if (!expectedPassword) {
    throw new Error(
      '[MegaVault] SITE_PASSWORD env var is not set. Set it in your Render environment variables.'
    );
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(password.padEnd(256));
    const b = Buffer.from(expectedPassword.padEnd(256));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b) && password.length === expectedPassword.length;
  } catch {
    return false;
  }
}

export async function createAuthSession(): Promise<string> {
  const SECRET_KEY = getSecretKey();
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET_KEY);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return token;
}

export async function destroyAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const SECRET_KEY = getSecretKey();
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return false;

    await jwtVerify(token, SECRET_KEY);
    return true;
  } catch {
    return false;
  }
}
