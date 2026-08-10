import { NextResponse } from 'next/server';
import { getAllAlbums, createAlbum } from '@/lib/db';
import { parseMegaUrl } from '@/lib/mega';
import { getFolderSnapshot } from '@/lib/cache/snapshots';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dbAlbums = await getAllAlbums();

    // Fast resolution from DB + disk snapshot (0ms network delay)
    const albumsWithStats = dbAlbums.map((alb) => {
      const cacheKey = `mega_media_${alb.id}_${alb.mega_link}_root`;
      const snapshot = getFolderSnapshot(cacheKey);

      return {
        id: alb.id,
        title: alb.title,
        description: alb.description,
        megaUrl: alb.mega_link,
        createdAt: alb.created_at,
        updatedAt: alb.updated_at ?? alb.created_at,
        status: 'ACTIVE' as const,
        mediaCount: snapshot?.mediaCount ?? { total: 0, images: 0, videos: 0 },
        subfolderCount: snapshot?.subfolders?.length ?? 0,
        coverUrl: snapshot?.items?.find((i) => i.mediaType === 'IMAGE')?.streamUrl ?? snapshot?.items[0]?.thumbnailUrl ?? alb.cover_image_url ?? null,
      };
    });

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
