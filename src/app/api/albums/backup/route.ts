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

    const existingAlbums = await getAllAlbums();
    const existingLinksMap = new Map<string, string>();
    for (const ext of existingAlbums) {
      existingLinksMap.set(ext.mega_link, ext.id);
    }

    let restoredCount = 0;
    for (const item of albumsToImport) {
      const title = item.title || item.albumTitle || 'MEGA Album';
      const megaLink = item.mega_link || item.megaUrl;
      const description = item.description || '';

      if (megaLink && megaLink.trim()) {
        const trimmedLink = megaLink.trim();
        // Use existing ID if link already exists, otherwise create new ID
        const id = existingLinksMap.get(trimmedLink) || item.id || `alb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        await createAlbum({
          id,
          title: title.trim(),
          description: description ? description.trim() : undefined,
          megaLink: trimmedLink,
        });
        restoredCount++;
      }
    }

    return NextResponse.json({
      success: true,
      restoredCount,
      message: `Successfully synced ${restoredCount} folder links to database.`,
    });
  } catch (error) {
    console.error('Backup import error:', error);
    return NextResponse.json({ error: 'Failed to import backup payload' }, { status: 500 });
  }
}

