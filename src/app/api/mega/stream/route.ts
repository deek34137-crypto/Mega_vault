import { NextResponse } from 'next/server';
import { getAlbumById } from '@/lib/db';
import { getMegaFileByHandle, fetchMegaFolderMedia } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_STREAM_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunk cap for instant video buffering & fast seeking

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

    let mimeType = 'application/octet-stream';
    if (ext === 'mp4') mimeType = 'video/mp4';
    else if (ext === 'webm') mimeType = 'video/webm';
    else if (ext === 'mov') mimeType = 'video/quicktime';
    else if (ext === 'mkv') mimeType = 'video/x-matroska';
    else if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'heic') mimeType = 'image/heic';
    else if (ext === 'svg') mimeType = 'image/svg+xml';

    const range = request.headers.get('range');

    // Handle HTTP Range Requests for smooth video seeking & HTML5 playback
    if (range && fileSize > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Adaptive Chunk Sizing for Large Files (400MB - 1.3GB+):
      // - First request at start=0: 4MB chunk for instant 200ms playback start
      // - Sustained playback (start > 0): 16MB chunk to keep 1080p/4K bitrate smooth without frequent range request bottlenecks
      const maxChunk = start === 0 ? 4 * 1024 * 1024 : 16 * 1024 * 1024;

      if (end - start + 1 > maxChunk) {
        end = Math.min(start + maxChunk - 1, fileSize - 1);
      }

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
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
          'Cache-Control': 'public, max-age=86400, immutable',
        },
      });
    }

    // Full content stream capped to initial 4MB chunk if un-ranged
    const end = fileSize > 0 ? Math.min(4 * 1024 * 1024 - 1, fileSize - 1) : undefined;
    const nodeStream = targetFile.download(end !== undefined ? { start: 0, end } : undefined);
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as any, {
      status: end !== undefined ? 206 : 200,
      headers: {
        'Content-Type': mimeType,
        ...(end !== undefined
          ? {
              'Content-Range': `bytes 0-${end}/${fileSize}`,
              'Content-Length': (end + 1).toString(),
            }
          : { 'Content-Length': fileSize.toString() }),
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('Error streaming MEGA file:', error);
    return NextResponse.json({ error: 'Failed to stream media file' }, { status: 500 });
  }
}
