import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'megavault_session';
const SECRET_KEY = new TextEncoder().encode(
  process.env.COOKIE_SECRET || 'megavault-super-secret-key-32chars!'
);

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/_next', '/favicon.ico'];

export async function proxy(request: NextRequest) {
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
    await jwtVerify(token, SECRET_KEY);
    return NextResponse.next();
  } catch (err) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
