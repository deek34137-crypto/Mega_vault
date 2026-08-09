import { NextResponse } from 'next/server';
import { getAllAlbums, createAlbum } from '@/lib/db';
import { fetchMegaFolderMedia, parseMegaUrl } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dbAlbums = await getAllAlbums();

    // Fetch media count for each album in parallel (not sequentially)
    const albumsWithStats = await Promise.all(
      dbAlbums.map(async (alb) => {
        const folderMedia = await fetchMegaFolderMedia(alb.id, alb.mega_link);
        return {
          id: alb.id,
          title: alb.title,
          description: alb.description,
          megaUrl: alb.mega_link,
          createdAt: alb.created_at,
          updatedAt: alb.updated_at ?? alb.created_at,
          status: 'ACTIVE' as const,
          mediaCount: folderMedia.mediaCount,
          subfolderCount: folderMedia.subfolders?.length || 0,
          coverUrl: folderMedia.items[0]?.thumbnailUrl ?? null,
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

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!megaUrl || typeof megaUrl !== 'string') {
      return NextResponse.json({ error: 'MEGA URL is required' }, { status: 400 });
    }

    // Validate the MEGA URL format before storing
    const parsed = parseMegaUrl(megaUrl.trim());
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            'Invalid MEGA folder URL. Expected format: https://mega.nz/folder/FOLDER_ID#KEY',
        },
        { status: 400 }
      );
    }

    const id = `alb-${Date.now()}`;
    const album = await createAlbum({
      id,
      title: title.trim(),
      description: description?.trim() || undefined,
      megaLink: megaUrl.trim(),
    });

    return NextResponse.json({ success: true, album });
  } catch (error) {
    console.error('POST /api/albums error:', error);
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }
}
