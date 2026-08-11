import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isAuthenticated } from '@/lib/auth';
import { createShareLink, getAllShareLinks, getAlbumById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { albumId, subfolderPath, pin, expiresInHours } = body;

    if (!albumId) {
      return NextResponse.json({ error: 'albumId is required' }, { status: 400 });
    }

    const album = await getAlbumById(albumId);
    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const token = crypto.randomBytes(16).toString('hex');
    let pinHash: string | undefined = undefined;
    if (pin && typeof pin === 'string' && pin.trim() !== '') {
      pinHash = crypto.createHash('sha256').update(pin.trim()).digest('hex');
    }

    let expiresAt: string | undefined = undefined;
    if (expiresInHours && typeof expiresInHours === 'number' && expiresInHours > 0) {
      expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
    }

    const link = await createShareLink({
      token,
      albumId,
      subfolderPath: subfolderPath || null,
      pinHash: pinHash || null,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json({
      success: true,
      token,
      shareUrl: `/share/${token}`,
      link,
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const links = await getAllShareLinks();
    return NextResponse.json({ success: true, links });
  } catch (error) {
    console.error('Error listing share links:', error);
    return NextResponse.json({ error: 'Failed to list share links' }, { status: 500 });
  }
}
