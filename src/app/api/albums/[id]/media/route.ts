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

  const { id } = await params;
  const album = await getAlbumById(id);

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  try {
    const result = await fetchMegaFolderMedia(album.id, album.mega_link);
    return NextResponse.json({ album, ...result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}
