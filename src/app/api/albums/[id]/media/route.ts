import { NextResponse } from 'next/server';
import { getAlbumById } from '@/lib/db';
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

    if (!album || !album.mega_link) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Protect against execution hangs with a 50s timeout race for initial large MEGA indexing
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
        50000
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
