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
      const rootCacheKey = `mega_media_${alb.id}_${alb.mega_link}_root`;
      const allCacheKey = `mega_all_media_${alb.id}_${alb.mega_link}`;
      const rootSnapshot = getFolderSnapshot(rootCacheKey);
      const allSnapshot: any = getFolderSnapshot(allCacheKey);

      const subfolders = rootSnapshot?.subfolders ?? [];
      const subfolderCount = allSnapshot?.subfolderCount ?? rootSnapshot?.subfolderCount ?? subfolders.length;
      const mediaCount = allSnapshot?.mediaCount ?? rootSnapshot?.mediaCount ?? { total: 0, images: 0, videos: 0 };

      return {
        id: alb.id,
        title: alb.title,
        description: alb.description,
        megaUrl: alb.mega_link,
        createdAt: alb.created_at,
        updatedAt: alb.updated_at ?? alb.created_at,
        status: 'ACTIVE' as const,
        mediaCount,
        subfolderCount,
        subfolders,
        coverUrl: rootSnapshot?.items?.find((i) => i.mediaType === 'IMAGE')?.streamUrl ?? rootSnapshot?.items[0]?.thumbnailUrl ?? alb.cover_image_url ?? null,
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

    // ─── DEDUPLICATION CHECK ───
    const existingAlbums = await getAllAlbums();
    const cleanMegaUrl = megaUrl.trim();
    const cleanTitle = title.trim();

    // 1. Deduplicate by MEGA URL or Folder ID
    const duplicateByUrl = existingAlbums.find((alb) => {
      if (alb.mega_link.trim() === cleanMegaUrl) return true;
      const albParsed = parseMegaUrl(alb.mega_link);
      return albParsed && albParsed.folderId === parsed.folderId;
    });

    if (duplicateByUrl) {
      return NextResponse.json(
        {
          error: `This MEGA folder is already in your vault as "${duplicateByUrl.title}".`,
          existingAlbumId: duplicateByUrl.id,
        },
        { status: 409 }
      );
    }

    // 2. Deduplicate by Album Title (case-insensitive)
    const duplicateByTitle = existingAlbums.find(
      (alb) => alb.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    );

    if (duplicateByTitle) {
      return NextResponse.json(
        {
          error: `An album named "${duplicateByTitle.title}" already exists.`,
          existingAlbumId: duplicateByTitle.id,
        },
        { status: 409 }
      );
    }

    const id = `alb-${Date.now()}`;
    const album = await createAlbum({
      id,
      title: cleanTitle,
      description: description?.trim() || undefined,
      megaLink: cleanMegaUrl,
    });

    return NextResponse.json({ success: true, album });
  } catch (error) {
    console.error('POST /api/albums error:', error);
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }
}
