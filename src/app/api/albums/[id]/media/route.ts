import { NextResponse } from 'next/server';
import { getAlbumById } from '@/lib/db';
import { fetchMegaFolderMedia } from '@/lib/mega';
import { getFolderSnapshot } from '@/lib/cache/snapshots';
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
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const typeParam = searchParams.get('type') || 'all';
    const searchQuery = searchParams.get('search') || '';

    let album = await getAlbumById(id);

    if (!album || !album.mega_link) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const cacheKey = `mega_media_${album.id}_${album.mega_link}_${subfolderPath || 'root'}`;

    // Protect against execution hangs with a 45s timeout race
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => {
        const snapshot = getFolderSnapshot(cacheKey);
        if (snapshot) {
          resolve({
            ...snapshot,
            isFromSnapshot: true,
            timedOut: true,
            errorMessage: 'MEGA connection timed out; showing saved folder snapshot.',
          });
        } else {
          resolve({
            albumId: album.id,
            items: [],
            subfolders: [],
            mediaCount: { total: 0, images: 0, videos: 0 },
            timedOut: true,
          });
        }
      }, 45000)
    );

    const fetchPromise = fetchMegaFolderMedia(album.id, album.mega_link, subfolderPath);
    const result: any = await Promise.race([fetchPromise, timeoutPromise]);

    const safeAlbum = {
      id: album.id,
      title: album.title,
      description: album.description,
      createdAt: album.created_at,
      updatedAt: album.updated_at ?? album.created_at,
    };

    let items = result.items || [];
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      items = items.filter((m: any) => m.fileName.toLowerCase().includes(q));
    }
    if (typeParam === 'images') {
      items = items.filter((m: any) => m.mediaType === 'IMAGE');
    } else if (typeParam === 'videos') {
      items = items.filter((m: any) => m.mediaType === 'VIDEO');
    }

    let paginationData = undefined;
    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || '1', 10));
      const limit = Math.max(1, parseInt(limitParam || '24', 10));
      const totalItems = items.length;
      const totalPages = Math.ceil(totalItems / limit) || 1;
      const startIndex = (page - 1) * limit;
      items = items.slice(startIndex, startIndex + limit);

      paginationData = {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
      };
    }

    return NextResponse.json({
      album: safeAlbum,
      ...result,
      items,
      ...(paginationData ? { pagination: paginationData } : {}),
    });
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
