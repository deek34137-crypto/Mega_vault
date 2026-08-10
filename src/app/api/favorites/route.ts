import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAllFavorites, toggleFavorite } from '@/lib/db';
import { MediaItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawFavs = await getAllFavorites();
    const items: MediaItem[] = rawFavs.map((f) => {
      const isVideo = f.media_type === 'VIDEO';
      const ext = f.file_name.split('.').pop()?.toLowerCase() || '';
      return {
        id: `fav-${f.album_id}-${f.handle}`,
        albumId: f.album_id,
        fileHandle: f.handle,
        fileName: f.file_name,
        mimeType: f.mime_type || (isVideo ? `video/${ext}` : `image/${ext}`),
        mediaType: (f.media_type as any) || (isVideo ? 'VIDEO' : 'IMAGE'),
        size: f.size || 0,
        createdAt: f.created_at,
        thumbnailUrl: f.thumbnail_url || (isVideo ? `/api/mega/thumbnail?albumId=${f.album_id}&handle=${encodeURIComponent(f.handle)}` : undefined),
        streamUrl: `/api/mega/stream?albumId=${f.album_id}&handle=${encodeURIComponent(f.handle)}`,
        isFavorite: true,
      };
    });

    return NextResponse.json({ favorites: items, count: items.length });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { albumId, handle, fileName, mimeType, mediaType, size, thumbnailUrl } = body;

    if (!albumId || !handle || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters: albumId, handle, fileName' }, { status: 400 });
    }

    const result = await toggleFavorite({
      albumId,
      handle,
      fileName,
      mimeType: mimeType || 'application/octet-stream',
      mediaType: mediaType || 'IMAGE',
      size: Number(size) || 0,
      thumbnailUrl,
    });

    const allFavs = await getAllFavorites();

    return NextResponse.json({
      success: true,
      isFavorite: result.isFavorite,
      count: allFavs.length,
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 });
  }
}
