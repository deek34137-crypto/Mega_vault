import { NextResponse } from 'next/server';
import { verifyPassword, createAuthSession, destroyAuthSession, isAuthenticated } from '@/lib/auth';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (record && now < record.resetAt && record.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait 1 minute before trying again.' },
        { status: 429 }
      );
    }

    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (!verifyPassword(password)) {
      if (!record || now > record.resetAt) {
        loginAttempts.set(ip, { attempts: 1, resetAt: now + WINDOW_MS });
      } else {
        record.attempts += 1;
      }
      return NextResponse.json({ error: 'Incorrect site password' }, { status: 401 });
    }

    // Success — reset attempts for IP
    loginAttempts.delete(ip);
    await createAuthSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  // Only destroy a session that actually exists (prevents CSRF-triggered forced logout)
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  await destroyAuthSession();
  return NextResponse.json({ success: true });
}
