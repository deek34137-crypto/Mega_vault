import { NextResponse } from 'next/server';
import { getAlbumById } from '@/lib/db';
import { fetchMegaFolderMedia } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';

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
    const album = await getAlbumById(id);

    if (!album) {
      // Return graceful empty response instead of crashing with 404
      return NextResponse.json({
        album: {
          id,
          title: 'Album',
          description: '',
          mega_link: '',
          created_at: new Date().toISOString(),
        },
        items: [],
        mediaCount: { total: 0, images: 0, videos: 0 },
      });
    }

    const result = await fetchMegaFolderMedia(album.id, album.mega_link);
    return NextResponse.json({ album, ...result });
  } catch (error) {
    console.error('Error fetching album media:', error);
    return NextResponse.json({
      album: null,
      items: [],
      mediaCount: { total: 0, images: 0, videos: 0 },
      error: 'Failed to fetch album media',
    });
  }
}
