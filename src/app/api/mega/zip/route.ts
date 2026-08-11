import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAlbumById, getAllFavorites, getShareLinkByToken } from '@/lib/db';
import { fetchMegaFolderMedia, getMegaFileByHandle } from '@/lib/mega';
import * as archiverModule from 'archiver';
import { Readable } from 'stream';

const archiver = (archiverModule as any).default || archiverModule;

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 mins for streaming zip

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get('albumId');
  const subfolder = searchParams.get('subfolder') || undefined;
  const handlesParam = searchParams.get('handles'); // optional comma-separated handles
  const isFavoritesZip = searchParams.get('favorites') === 'true';
  const shareToken = searchParams.get('shareToken');

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

  try {
    let itemsToZip: { albumId: string; fileHandle: string; fileName: string }[] = [];
    let zipFilename = 'megavault-download.zip';

    if (isFavoritesZip) {
      const favs = await getAllFavorites();
      itemsToZip = favs.map((f) => ({
        albumId: f.album_id,
        fileHandle: f.handle,
        fileName: f.file_name,
      }));
      zipFilename = 'favorites-collection.zip';
    } else if (albumId) {
      const album = await getAlbumById(albumId);
      if (!album || !album.mega_link) {
        return NextResponse.json({ error: 'Album not found' }, { status: 404 });
      }

      const mediaResult = await fetchMegaFolderMedia(album.id, album.mega_link, subfolder);
      let mediaItems = mediaResult.items || [];

      if (handlesParam) {
        const handleSet = new Set(handlesParam.split(',').map((h) => h.trim()));
        mediaItems = mediaItems.filter((m) => handleSet.has(m.fileHandle) || handleSet.has(m.id));
      }

      itemsToZip = mediaItems.map((m) => ({
        albumId: album.id,
        fileHandle: m.fileHandle,
        fileName: m.fileName,
      }));

      const safeAlbumTitle = (album.title || 'album').replace(/[^a-zA-Z0-9_-]/g, '_');
      zipFilename = `${safeAlbumTitle}${subfolder ? `_${subfolder.replace(/\//g, '_')}` : ''}.zip`;
    } else {
      return NextResponse.json({ error: 'albumId or favorites parameter required' }, { status: 400 });
    }

    if (itemsToZip.length === 0) {
      return NextResponse.json({ error: 'No media items found to download' }, { status: 404 });
    }

    // Create Zip Archiver Stream with level 0 (store mode) for maximum streaming throughput
    const archive = archiver('zip', { zlib: { level: 0 } });

    // Handle archiver errors
    archive.on('error', (err: any) => {
      console.error('[MegaVault ZIP Stream Error]:', err);
    });

    // Asynchronously fetch MEGA file nodes in parallel (concurrency = 4) and append download streams to archive
    (async () => {
      const albumCache = new Map<string, any>();
      const CONCURRENCY_LIMIT = 4;
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < itemsToZip.length) {
          const index = currentIndex++;
          const item = itemsToZip[index];
          try {
            let album = albumCache.get(item.albumId);
            if (!album) {
              album = await getAlbumById(item.albumId);
              if (album) albumCache.set(item.albumId, album);
            }
            if (!album || !album.mega_link) continue;

            const fileNode = await getMegaFileByHandle(album.id, album.mega_link, item.fileHandle);
            if (fileNode && typeof fileNode.download === 'function') {
              const nodeStream = fileNode.download();
              archive.append(nodeStream, { name: item.fileName });
            } else {
              console.warn(`[MegaVault ZIP] Could not locate file handle ${item.fileHandle} for ${item.fileName}`);
            }
          } catch (itemErr) {
            console.error(`[MegaVault ZIP] Failed to append ${item.fileName}:`, itemErr);
          }
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, itemsToZip.length) }, () => worker());
      await Promise.all(workers);
      archive.finalize();
    })();

    const webStream = Readable.toWeb(archive as unknown as Readable);

    return new Response(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(zipFilename)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating streamed ZIP archive:', error);
    return NextResponse.json({ error: 'Failed to generate ZIP download stream' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { albumId, subfolder, handles, favorites } = body;

    let targetUrl = `/api/mega/zip?`;
    if (favorites) {
      targetUrl += `favorites=true`;
    } else if (albumId) {
      targetUrl += `albumId=${encodeURIComponent(albumId)}`;
      if (subfolder) targetUrl += `&subfolder=${encodeURIComponent(subfolder)}`;
      if (Array.isArray(handles) && handles.length > 0) {
        targetUrl += `&handles=${encodeURIComponent(handles.join(','))}`;
      }
    }

    return NextResponse.json({ downloadUrl: targetUrl });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
