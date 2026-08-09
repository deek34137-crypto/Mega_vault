import { NextResponse } from 'next/server';
import { getAlbumById, getAllAlbums } from '@/lib/db';
import { fetchMegaFolderMedia } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Up to 60s execution limit on Vercel serverless

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const subfolderPath = searchParams.get('folder') || undefined;

    let album = await getAlbumById(id);

    // Fallback: If album is not found by exact ID, search across all DB albums
    if (!album) {
      const allAlbums = await getAllAlbums();
      if (allAlbums.length > 0) {
        album = allAlbums[0]; // Fallback to active album
      }
    }

    if (!album || !album.mega_link) {
      return NextResponse.json({
        album: {
          id: id || 'demo',
          title: 'Media Album',
          description: '',
          mega_link: '',
          createdAt: new Date().toISOString(),
        },
        items: [],
        subfolders: [],
        mediaCount: { total: 0, images: 0, videos: 0 },
      });
    }

    // Protect against execution hangs with a 10s timeout race
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            albumId: album.id,
            items: [],
            subfolders: [],
            mediaCount: { total: 0, images: 0, videos: 0 },
            timedOut: true,
          }),
        10000
      )
    );

    const fetchPromise = fetchMegaFolderMedia(album.id, album.mega_link, subfolderPath);
    const result: any = await Promise.race([fetchPromise, timeoutPromise]);

    return NextResponse.json({ album, ...result });
  } catch (error) {
    console.error('Error fetching album media:', error);
    return NextResponse.json({
      album: null,
      items: [],
      subfolders: [],
      mediaCount: { total: 0, images: 0, videos: 0 },
      error: 'Failed to fetch album media',
    });
  }
}
