import { NextResponse } from 'next/server';
import { getAlbumById } from '@/lib/db';
import { getMegaFileByHandle, fetchMegaFolderMedia } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';
import { Readable } from 'stream';

export async function GET(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get('albumId');
  const handle = searchParams.get('handle');

  if (!albumId || !handle) {
    return NextResponse.json({ error: 'Album ID and File handle required' }, { status: 400 });
  }

  const album = await getAlbumById(albumId);
  if (!album || !album.mega_link) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  try {
    let targetFile = await getMegaFileByHandle(album.id, album.mega_link, handle);

    // Fallback: If not in cache, invoke fetchMegaFolderMedia once to load and populate cache
    if (!targetFile) {
      await fetchMegaFolderMedia(album.id, album.mega_link);
      targetFile = await getMegaFileByHandle(album.id, album.mega_link, handle);
    }

    if (!targetFile) {
      return NextResponse.json({ error: 'File handle not found in folder' }, { status: 404 });
    }

    const fileSize = targetFile.size || 0;
    const fileName = targetFile.name || 'video.mp4';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    let mimeType = 'video/mp4';
    if (ext === 'webm') mimeType = 'video/webm';
    if (ext === 'mov') mimeType = 'video/quicktime';
    if (ext === 'mkv') mimeType = 'video/x-matroska';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) mimeType = `image/${ext}`;

    const range = request.headers.get('range');

    // Handle HTTP Range Requests for smooth video seeking & HTML5 playback
    if (range && fileSize > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const nodeStream = targetFile.download({ start, end });
      const webStream = Readable.toWeb(nodeStream);

      return new Response(webStream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Full content stream
    const nodeStream = targetFile.download({});
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error streaming MEGA file:', error);
    return NextResponse.json({ error: 'Failed to stream media file' }, { status: 500 });
  }
}
