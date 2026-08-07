import { NextResponse } from 'next/server';
import { getAlbumById } from '@/lib/db';
import { fetchMegaFolderMedia, clearMegaFolderCache } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const album = await getAlbumById(id);

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  try {
    clearMegaFolderCache(album.id, album.mega_link);
    const updatedMedia = await fetchMegaFolderMedia(album.id, album.mega_link, true);

    return NextResponse.json({ success: true, media: updatedMedia });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to refresh album' }, { status: 500 });
  }
}
