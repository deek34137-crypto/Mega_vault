import { NextResponse } from 'next/server';
import { getAlbumById, getShareLinkByToken } from '@/lib/db';
import { getMegaFileByHandle, fetchMegaFolderMedia } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';
import { imageBufferCache, videoChunkCache } from '@/lib/cache';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get('albumId');
  const handle = searchParams.get('handle');
  const shareToken = searchParams.get('shareToken');
  const isDownload = searchParams.get('download') === 'true';

  let authorized = await isAuthenticated();
  if (!authorized && shareToken && albumId) {
    const link = await getShareLinkByToken(shareToken);
    if (link && link.album_id === albumId) {
      const notExpired = !link.expires_at || new Date(link.expires_at).getTime() > Date.now();
      if (notExpired) authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!albumId || !handle) {
    return NextResponse.json({ error: 'Album ID and File handle required' }, { status: 400 });
  }

  const album = await getAlbumById(albumId);
  if (!album || !album.mega_link) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  try {
    let targetFile = await getMegaFileByHandle(album.id, album.mega_link, handle);

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
      if (request.signal) {
        if (request.signal.aborted) {
          nodeStream.destroy();
        } else {
          request.signal.addEventListener('abort', () => nodeStream.destroy());
        }
      }
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
          const imgStream = targetFile.download((err: any, data: Buffer) => {
            if (err) reject(err);
            else resolve(data);
          });
          if (request.signal) {
            if (request.signal.aborted) imgStream?.destroy?.();
            else request.signal.addEventListener('abort', () => imgStream?.destroy?.());
          }
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
      }
    }

    const range = request.headers.get('range');

    // Handle HTTP Range Requests for smooth video seeking & HTML5 playback
    if (range && fileSize > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;

      let end: number;
      if (parts[1] && parts[1].trim() !== '') {
        const requestedEnd = parseInt(parts[1], 10);
        end = Math.min(requestedEnd, fileSize - 1);
      } else {
        end = fileSize - 1;
      }

      if (end < start) end = Math.min(start + 1024 * 1024, fileSize - 1);
      const chunkSize = end - start + 1;
      const videoCacheKey = `${album.id}_${handle}_${start}_${end}`;

      // FAST PATH: If initial chunk is already cached in RAM, serve instantly (1ms)
      if (start === 0 && videoChunkCache) {
        const cachedChunk = videoChunkCache.get(videoCacheKey);
        if (cachedChunk) {
          return new Response(cachedChunk.buffer as any, {
            status: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': cachedChunk.buffer.length.toString(),
              'Content-Type': mimeType,
              'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Video-FastStart': 'RAM-Cache-Hit',
            },
          });
        }
      }

      // Stream directly without blocking headers, allowing instant <50ms response start
      const nodeStream = targetFile.download({
        start,
        end,
        initialChunkSize: 256 * 1024,
        maxChunkSize: 2 * 1024 * 1024,
      });

      if (request.signal) {
        if (request.signal.aborted) {
          nodeStream.destroy();
        } else {
          request.signal.addEventListener('abort', () => {
            nodeStream.destroy();
          });
        }
      }

      nodeStream.on('error', (err: any) => {
        console.error(`[MEGA Stream Node Exception for ${fileName} (${start}-${end})]:`, err);
      });
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
          'X-Video-FastStart': 'Stream',
        },
      });
    }

    // Un-ranged Requests (when browser asks for entire file directly):
    const nodeStream = targetFile.download({
      initialChunkSize: 256 * 1024,
      maxChunkSize: 2 * 1024 * 1024,
    });
    if (request.signal) {
      if (request.signal.aborted) {
        nodeStream.destroy();
      } else {
        request.signal.addEventListener('abort', () => {
          nodeStream.destroy();
        });
      }
    }
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
  } catch (error) {
    console.error('Error streaming MEGA file:', error);
    return NextResponse.json({ error: 'Failed to stream media file' }, { status: 500 });
  }
}
