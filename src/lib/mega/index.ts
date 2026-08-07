import { File as MegaFile } from 'megajs';
import { MediaItem, MediaType } from '@/types';
import { mediaCache } from '@/lib/cache';
import { SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS, MOCK_MEDIA } from '@/lib/constants';

export interface MegaFolderResult {
  albumId: string;
  items: MediaItem[];
  mediaCount: {
    total: number;
    images: number;
    videos: number;
  };
}

export function parseMegaUrl(url: string): { folderId: string; key: string } | null {
  try {
    const parsed = new URL(url);

    // Format 1: https://mega.nz/folder/HANDLE#KEY
    if (parsed.pathname.startsWith('/folder/')) {
      const folderId = parsed.pathname.replace('/folder/', '').replace('/', '');
      const key = parsed.hash.replace('#', '');
      if (folderId && key) return { folderId, key };
    }

    // Format 2: https://mega.nz/#F!HANDLE!KEY
    if (parsed.hash.startsWith('#F!')) {
      const parts = parsed.hash.split('!');
      if (parts.length >= 3) {
        return { folderId: parts[1], key: parts[2] };
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

export async function fetchMegaFolderMedia(
  albumId: string,
  megaUrl: string,
  forceRefresh = false
): Promise<MegaFolderResult> {
  const cacheKey = `mega_media_${albumId}_${megaUrl}`;

  if (!forceRefresh) {
    const cached = mediaCache.get<MegaFolderResult>(cacheKey);
    if (cached) return cached;
  }

  // Handle mock/sample URLs gracefully for immediate UI testing
  if (megaUrl.includes('example') || !megaUrl.startsWith('http')) {
    const mockItems = MOCK_MEDIA.filter((m) => m.albumId === albumId);
    const result: MegaFolderResult = {
      albumId,
      items: mockItems.length > 0 ? mockItems : MOCK_MEDIA,
      mediaCount: {
        total: mockItems.length > 0 ? mockItems.length : MOCK_MEDIA.length,
        images: (mockItems.length > 0 ? mockItems : MOCK_MEDIA).filter((m) => m.mediaType === 'IMAGE').length,
        videos: (mockItems.length > 0 ? mockItems : MOCK_MEDIA).filter((m) => m.mediaType === 'VIDEO').length,
      },
    };
    mediaCache.set(cacheKey, result);
    return result;
  }

  try {
    const folder = MegaFile.fromURL(megaUrl);
    await folder.loadAttributes();

    const items: MediaItem[] = [];
    let imageCount = 0;
    let videoCount = 0;

    if (folder.children) {
      for (const child of folder.children) {
        if (child.directory) continue; // Skip subdirectories for V1

        const name = child.name || 'unnamed_file';
        const ext = name.split('.').pop()?.toLowerCase() || '';

        let mediaType: MediaType | null = null;
        if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          mediaType = 'IMAGE';
          imageCount++;
        } else if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
          mediaType = 'VIDEO';
          videoCount++;
        }

        if (mediaType) {
          items.push({
            id: `med-${child.downloadId || Math.random().toString(36).substring(7)}`,
            albumId,
            fileHandle: child.downloadId || child.name || '',
            fileName: name,
            mimeType: mediaType === 'IMAGE' ? `image/${ext}` : `video/${ext}`,
            mediaType,
            size: child.size || 0,
            createdAt: child.timestamp ? new Date(child.timestamp * 1000).toISOString() : new Date().toISOString(),
            thumbnailUrl: (child as any).thumbnailUrl || undefined,
          });
        }
      }
    }

    const result: MegaFolderResult = {
      albumId,
      items,
      mediaCount: {
        total: items.length,
        images: imageCount,
        videos: videoCount,
      },
    };

    mediaCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error reading MEGA folder link:', error);
    // Return empty result rather than crashing
    return {
      albumId,
      items: [],
      mediaCount: { total: 0, images: 0, videos: 0 },
    };
  }
}

export function clearMegaFolderCache(albumId: string, megaUrl: string) {
  const cacheKey = `mega_media_${albumId}_${megaUrl}`;
  mediaCache.clear(cacheKey);
}
