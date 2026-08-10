import { NextResponse } from 'next/server';
import { getVideoThumbnail, saveVideoThumbnail } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';
import { mediaCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get('albumId');
  const handle = searchParams.get('handle');

  if (!albumId || !handle) {
    return NextResponse.json({ error: 'Missing albumId or handle' }, { status: 400 });
  }

  try {
    const dataUrl = await getVideoThumbnail(albumId, handle);
    if (!dataUrl) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    // Convert data URL (data:image/jpeg;base64,...) to raw Buffer
    const matches = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Invalid thumbnail data format' }, { status: 500 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    return new Response(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error fetching video thumbnail:', error);
    return NextResponse.json({ error: 'Failed to fetch thumbnail' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { albumId, handle, thumbnailDataUrl } = body;

    if (!albumId || !handle || !thumbnailDataUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save to Turso / SQLite DB
    await saveVideoThumbnail(albumId, handle, thumbnailDataUrl);

    // Invalidate folder cache for this album so media lists return updated thumbnailUrl
    mediaCache.clearByPrefix(`mega_media_${albumId}_`);

    return NextResponse.json({ success: true, message: 'Thumbnail saved successfully' });
  } catch (error) {
    console.error('Error saving video thumbnail:', error);
    return NextResponse.json({ error: 'Failed to save thumbnail' }, { status: 500 });
  }
}
