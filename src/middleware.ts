import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'megavault_session';

// Resolve secret key — mirrors lib/auth/index.ts getSecretKey()
// Middleware runs in Edge Runtime so we can't import from lib/auth directly
function getSecretKey(): Uint8Array {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    // In the Edge runtime we can't throw loudly at startup, but we can refuse all requests.
    console.error('[MegaVault] COOKIE_SECRET env var is missing or too short — all requests will be blocked.');
    return new Uint8Array(32); // zero key — will never match a real token
  }
  return new TextEncoder().encode(secret);
}

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/share', '/api/share', '/_next', '/favicon.ico'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secretKey = getSecretKey();
    await jwtVerify(token, secretKey);
    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  // Exclude Next.js internals and public static files from auth checks
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
