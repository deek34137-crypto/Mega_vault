import { File as MegaFile } from 'megajs';
import { MediaItem, MediaType } from '@/types';
import { mediaCache } from '@/lib/cache';
import { SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS, MOCK_MEDIA } from '@/lib/constants';

export interface MegaFolderResult {
  albumId: string;
  items: MediaItem[];
  subfolders: {
    name: string;
    path: string;
    itemCount: number;
  }[];
  mediaCount: {
    total: number;
    images: number;
    videos: number;
  };
}

export function parseMegaUrl(url: string): { folderId: string; key: string } | null {
  try {
    const parsed = new URL(url);

    if (parsed.pathname.startsWith('/folder/')) {
      const folderId = parsed.pathname.replace('/folder/', '').replace('/', '');
      const key = parsed.hash.replace('#', '');
      if (folderId && key) return { folderId, key };
    }

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
  subfolderPath?: string,
  forceRefresh = false
): Promise<MegaFolderResult> {
  const cacheKey = `mega_media_${albumId}_${megaUrl}_${subfolderPath || 'root'}`;

  if (!forceRefresh) {
    const cached = mediaCache.get<MegaFolderResult>(cacheKey);
    if (cached) return cached;
  }

  // Handle mock/sample URLs gracefully for testing
  if (megaUrl.includes('example') || !megaUrl.startsWith('http')) {
    const mockItems = MOCK_MEDIA.filter((m) => m.albumId === albumId);
    const result: MegaFolderResult = {
      albumId,
      items: mockItems.length > 0 ? mockItems : MOCK_MEDIA,
      subfolders: [],
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
    const rootFolder = MegaFile.fromURL(megaUrl);
    await rootFolder.loadAttributes();

    let targetNode: any = rootFolder;

    // Navigate to specified subfolder path if present
    if (subfolderPath) {
      const pathParts = subfolderPath.split('/');
      for (const part of pathParts) {
        if (!part) continue;
        if (targetNode.directory && (!targetNode.children || targetNode.children.length === 0)) {
          try {
            await targetNode.loadAttributes();
          } catch (e) {}
        }

        if (targetNode.children) {
          const match = targetNode.children.find((c: any) => c.directory && c.name === part);
          if (match) {
            targetNode = match;
          }
        }
      }
    }

    // Ensure target node attributes are loaded
    if (targetNode.directory && (!targetNode.children || targetNode.children.length === 0)) {
      try {
        await targetNode.loadAttributes();
      } catch (e) {}
    }

    const items: MediaItem[] = [];
    const detectedSubfolders: { name: string; path: string; itemCount: number }[] = [];
    let imageCount = 0;
    let videoCount = 0;

    if (targetNode.children && Array.isArray(targetNode.children)) {
      for (const child of targetNode.children) {
        if (child.directory) {
          // Load subfolder attributes to count items
          try {
            if (!child.children || child.children.length === 0) {
              await child.loadAttributes();
            }
          } catch (e) {}

          const childCount = child.children ? child.children.length : 0;
          detectedSubfolders.push({
            name: child.name || 'Subfolder',
            path: subfolderPath ? `${subfolderPath}/${child.name}` : child.name,
            itemCount: childCount,
          });
        } else {
          const rawName = child.name || 'unnamed_file';
          const ext = rawName.split('.').pop()?.toLowerCase() || '';

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
              fileName: rawName,
              mimeType: mediaType === 'IMAGE' ? `image/${ext}` : `video/${ext}`,
              mediaType,
              size: child.size || 0,
              createdAt: child.timestamp ? new Date(child.timestamp * 1000).toISOString() : new Date().toISOString(),
              thumbnailUrl: (child as any).thumbnailUrl || undefined,
              streamUrl: `/api/mega/stream?albumId=${albumId}&handle=${encodeURIComponent(child.downloadId || child.name || '')}`,
            });
          }
        }
      }
    }

    const result: MegaFolderResult = {
      albumId,
      items,
      subfolders: detectedSubfolders,
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
    return {
      albumId,
      items: [],
      subfolders: [],
      mediaCount: { total: 0, images: 0, videos: 0 },
    };
  }
}

export function clearMegaFolderCache(albumId: string, megaUrl: string) {
  const cacheKey = `mega_media_${albumId}_${megaUrl}_root`;
  mediaCache.clear(cacheKey);
}
