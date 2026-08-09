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

// Global in-memory cache for loaded MEGA root folder objects
interface CachedRootNode {
  rootFolder: any;
  timestamp: number;
  handleMap: Map<string, any>;
}

const megaRootCache = new Map<string, CachedRootNode>();
const pendingRootPromises = new Map<string, Promise<CachedRootNode>>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in-memory cache

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

// Clean string for robust fuzzy matching between folder names
function normalizeName(str: string): string {
  return str ? str.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

// Build a flat lookup map of file handles to nodes for instant stream retrieval
function buildHandleMap(node: any, map = new Map<string, any>()): Map<string, any> {
  if (!node) return map;

  if (node.downloadId) {
    map.set(node.downloadId, node);
  }
  if (node.name) {
    map.set(node.name, node);
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      buildHandleMap(child, map);
    }
  }

  return map;
}

// Fetch or reuse cached root MEGA folder node with Promise deduplication
async function getOrFetchRootFolder(megaUrl: string, forceRefresh = false): Promise<CachedRootNode> {
  if (!forceRefresh) {
    const cached = megaRootCache.get(megaUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached;
    }
  }

  if (pendingRootPromises.has(megaUrl) && !forceRefresh) {
    return pendingRootPromises.get(megaUrl)!;
  }

  const fetchPromise = (async () => {
    try {
      const rootFolder = MegaFile.fromURL(megaUrl);

      // Promisified loadAttributes with timeout resilience
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MEGA loadAttributes connection timed out'));
        }, 45000);

        rootFolder.loadAttributes((err: any, folder: any) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve(folder);
        });
      });

      const handleMap = buildHandleMap(rootFolder);
      const entry: CachedRootNode = {
        rootFolder,
        timestamp: Date.now(),
        handleMap,
      };

      megaRootCache.set(megaUrl, entry);
      return entry;
    } finally {
      pendingRootPromises.delete(megaUrl);
    }
  })();

  pendingRootPromises.set(megaUrl, fetchPromise);
  return fetchPromise;
}

// Look up target file node for stream requests without re-indexing MEGA
export async function getMegaFileByHandle(albumId: string, megaUrl: string, handle: string): Promise<any | null> {
  try {
    const cachedRoot = await getOrFetchRootFolder(megaUrl);
    if (cachedRoot && cachedRoot.handleMap.has(handle)) {
      return cachedRoot.handleMap.get(handle);
    }
    return null;
  } catch (err) {
    console.error('Error looking up Mega file by handle:', err);
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

  // Handle mock/sample URLs gracefully for immediate UI testing
  if (!megaUrl || megaUrl.includes('example') || !megaUrl.startsWith('http')) {
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
    const cachedRoot = await getOrFetchRootFolder(megaUrl, forceRefresh);
    const rootFolder = cachedRoot.rootFolder;

    let targetNode: any = rootFolder;

    // Subfolder Navigation over loaded in-memory tree
    if (subfolderPath) {
      const decodedPath = decodeURIComponent(subfolderPath);
      const pathParts = decodedPath.split('/').map((p) => p.trim()).filter(Boolean);

      for (const part of pathParts) {
        if (!targetNode || !targetNode.children || !Array.isArray(targetNode.children)) {
          targetNode = null;
          break;
        }

        const targetNorm = normalizeName(part);
        const match = targetNode.children.find((c: any) => {
          if (!c.directory) return false;
          const cName = (c.name || '').trim();
          return (
            cName === part ||
            cName.toLowerCase() === part.toLowerCase() ||
            normalizeName(cName) === targetNorm
          );
        });

        if (match) {
          targetNode = match;
        } else {
          targetNode = null;
          break;
        }
      }
    }

    const items: MediaItem[] = [];
    const detectedSubfolders: { name: string; path: string; itemCount: number }[] = [];
    let imageCount = 0;
    let videoCount = 0;

    if (targetNode && targetNode.children && Array.isArray(targetNode.children)) {
      for (const child of targetNode.children) {
        if (child.directory) {
          const childName = child.name || 'Subfolder';
          const fullSubPath = subfolderPath ? `${subfolderPath}/${childName}` : childName;

          // Count only files (non-directories) in immediate children if loaded
          let childFileCount = 0;
          if (child.children && Array.isArray(child.children)) {
            childFileCount = child.children.filter((c: any) => !c.directory).length;
          }

          detectedSubfolders.push({
            name: childName,
            path: fullSubPath,
            itemCount: childFileCount,
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
  megaRootCache.delete(megaUrl);
  pendingRootPromises.delete(megaUrl);
  // Clear all cache entries for this album (root + every subfolder path)
  const prefix = `mega_media_${albumId}_${megaUrl}_`;
  mediaCache.clearByPrefix(prefix);
}
