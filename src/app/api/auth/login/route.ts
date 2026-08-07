import { NextResponse } from 'next/server';
import { verifyPassword, createAuthSession, destroyAuthSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (!verifyPassword(password)) {
      return NextResponse.json({ error: 'Incorrect site password' }, { status: 401 });
    }

    await createAuthSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  await destroyAuthSession();
  return NextResponse.json({ success: true });
}
