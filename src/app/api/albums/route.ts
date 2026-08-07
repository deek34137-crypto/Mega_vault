import { NextResponse } from 'next/server';
import { getAllAlbums, createAlbum, deleteAlbum } from '@/lib/db';
import { fetchMegaFolderMedia, parseMegaUrl } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dbAlbums = getAllAlbums();

    // Fetch media count for each album
    const albumsWithStats = await Promise.all(
      dbAlbums.map(async (alb) => {
        const folderMedia = await fetchMegaFolderMedia(alb.id, alb.mega_link);
        return {
          id: alb.id,
          title: alb.title,
          description: alb.description,
          megaUrl: alb.mega_link,
          createdAt: alb.created_at,
          mediaCount: folderMedia.mediaCount,
          coverUrl: folderMedia.items[0]?.thumbnailUrl || null,
        };
      })
    );

    return NextResponse.json({ albums: albumsWithStats });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch albums' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, megaUrl } = await request.json();

    if (!title || !megaUrl) {
      return NextResponse.json({ error: 'Title and MEGA URL are required' }, { status: 400 });
    }

    const id = `alb-${Date.now()}`;
    const album = createAlbum({ id, title, description, megaLink: megaUrl });

    return NextResponse.json({ success: true, album });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
    }

    deleteAlbum(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete album' }, { status: 500 });
  }
}
