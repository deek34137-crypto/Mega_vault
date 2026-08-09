import { NextResponse } from 'next/server';
import { getAllAlbums, createAlbum } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const albums = await getAllAlbums();
    return NextResponse.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      albumsCount: albums.length,
      albums,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to export backup' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const albumsToImport = Array.isArray(body) ? body : Array.isArray(body.albums) ? body.albums : [];

    if (albumsToImport.length === 0) {
      return NextResponse.json({ error: 'No valid albums found in import payload' }, { status: 400 });
    }

    let restoredCount = 0;
    for (const item of albumsToImport) {
      const title = item.title;
      const megaLink = item.mega_link || item.megaUrl;
      const description = item.description || '';

      if (title && megaLink) {
        const id = item.id || `alb-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await createAlbum({
          id,
          title,
          description,
          megaLink,
        });
        restoredCount++;
      }
    }

    return NextResponse.json({
      success: true,
      restoredCount,
      message: `Successfully restored ${restoredCount} albums.`,
    });
  } catch (error) {
    console.error('Backup import error:', error);
    return NextResponse.json({ error: 'Failed to import backup payload' }, { status: 500 });
  }
}
