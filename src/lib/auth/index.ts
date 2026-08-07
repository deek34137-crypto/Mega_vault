import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'megavault_session';
const SECRET_KEY = new TextEncoder().encode(
  process.env.COOKIE_SECRET || 'megavault-super-secret-key-32chars!'
);

export function verifyPassword(password: string): boolean {
  const expectedPassword = process.env.SITE_PASSWORD || 'megavault2026';
  return password === expectedPassword;
}

export async function createAuthSession(): Promise<string> {
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
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return false;

    await jwtVerify(token, SECRET_KEY);
    return true;
  } catch (error) {
    return false;
  }
}
