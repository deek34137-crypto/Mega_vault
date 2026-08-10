import { NextResponse } from 'next/server';
import { getAlbumById } from '@/lib/db';
import { getMegaFileByHandle, fetchMegaFolderMedia } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';
import { imageBufferCache } from '@/lib/cache';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Maximum chunk size thresholds for smooth video streaming:
// - SMALL_FILE_MAX_SIZE (16MB): Files <= 16MB are streamed in full for 0-buffer playback.
// - INITIAL_CHUNK_LARGE (4MB): Initial range request chunk (4MB) for instant playback start within ~150ms.
// - SUSTAINED_CHUNK_LARGE (16MB): Sustained playback chunks for smooth seeking without Range overhead.
const SMALL_FILE_MAX_SIZE = 16 * 1024 * 1024;
const INITIAL_CHUNK_LARGE = 4 * 1024 * 1024;
const SUSTAINED_CHUNK_LARGE = 16 * 1024 * 1024;

export async function GET(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get('albumId');
  const handle = searchParams.get('handle');
  const isDownload = searchParams.get('download') === 'true';

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
    const fileName = targetFile.name || 'file';
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

    // ─── DOWNLOAD MODE: stream full file with attachment header ───
    if (isDownload) {
      const nodeStream = targetFile.download();
      const webStream = Readable.toWeb(nodeStream);
      return new Response(webStream as any, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSize > 0 ? fileSize.toString() : '',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // Fast path for Images: Serve cached buffer from memory in milliseconds
    const isImage = mimeType.startsWith('image/');
    if (isImage) {
      const cacheKey = `${album.id}_${handle}`;
      const cached = imageBufferCache.get(cacheKey);
      if (cached) {
        return new Response(cached.buffer as any, {
          status: 200,
          headers: {
            'Content-Type': cached.mimeType,
            'Content-Length': cached.buffer.length.toString(),
            'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }

      // Download image buffer directly into RAM cache
      try {
        const buffer = await new Promise<Buffer>((resolve, reject) => {
          targetFile.download((err: any, data: Buffer) => {
            if (err) reject(err);
            else resolve(data);
          });
        });

        imageBufferCache.set(cacheKey, buffer, mimeType);

        return new Response(buffer as any, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': buffer.length.toString(),
            'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch (err) {
        console.error('Error downloading image buffer:', err);
        // Fall back to streaming if buffer download fails
      }
    }

    const range = request.headers.get('range');

    // Handle HTTP Range Requests for smooth video seeking & HTML5 playback
    if (range && fileSize > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Smart Chunk Allocation:
      // 1. Files <= 32MB (e.g. 4.3MB video): Send remaining content to end of file in 1 response (no chunk cap).
      //    This eliminates secondary range requests near the end of small/medium videos!
      // 2. Remaining bytes <= 32MB: Send all remaining bytes to end of file.
      // 3. Files > 32MB: 16MB for start=0, 32MB for sustained seeking.
      if (fileSize <= SMALL_FILE_MAX_SIZE || fileSize - start <= SUSTAINED_CHUNK_LARGE) {
        end = fileSize - 1;
      } else {
        const maxChunk = start === 0 ? INITIAL_CHUNK_LARGE : SUSTAINED_CHUNK_LARGE;
        if (end - start + 1 > maxChunk) {
          end = Math.min(start + maxChunk - 1, fileSize - 1);
        }
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
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Un-ranged Requests (when browser asks for entire file directly):
    // - For files <= 32MB: Stream full file with HTTP 200 OK
    // - For files > 32MB: Cap initial stream to 32MB with HTTP 206 Partial Content
    if (fileSize <= SMALL_FILE_MAX_SIZE) {
      const nodeStream = targetFile.download();
      const webStream = Readable.toWeb(nodeStream);

      return new Response(webStream as any, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSize.toString(),
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } else {
      const end = Math.min(SUSTAINED_CHUNK_LARGE - 1, fileSize - 1);
      const nodeStream = targetFile.download({ start: 0, end });
      const webStream = Readable.toWeb(nodeStream);

      return new Response(webStream as any, {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Range': `bytes 0-${end}/${fileSize}`,
          'Content-Length': (end + 1).toString(),
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  } catch (error) {
    console.error('Error streaming MEGA file:', error);
    return NextResponse.json({ error: 'Failed to stream media file' }, { status: 500 });
  }
}
