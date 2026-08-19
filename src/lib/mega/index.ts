import { File as MegaFile } from 'megajs';
import { MediaItem, MediaType } from '@/types';
import { mediaCache } from '@/lib/cache';
import { getFolderSnapshot, saveFolderSnapshot, removeFolderSnapshot } from '@/lib/cache/snapshots';
import { SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS, MOCK_MEDIA } from '@/lib/constants';
import { getVideoThumbnailsForAlbum, updateAlbumCoverImage, deleteAlbum, getFavoriteHandles, getAllAlbums } from '@/lib/db';

export interface MegaFolderResult {
  albumId: string;
  items: MediaItem[];
  subfolders: {
    name: string;
    path: string;
    itemCount: number;
    imageCount?: number;
    videoCount?: number;
    subfolderCount?: number;
  }[];
  mediaCount: {
    total: number;
    images: number;
    videos: number;
  };
  subfolderCount?: number;
  isFromSnapshot?: boolean;
  isDeadLink?: boolean;
  errorMessage?: string;
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
const MAX_ROOT_CACHE_ENTRIES = 20; // Bound RAM usage to prevent memory leaks

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

const failedFetchCooldowns = new Map<string, number>();
const ERROR_COOLDOWN_MS = 15 * 1000; // 15 second retry cooldown after failure

// Helper to extract all valid string lookup keys for a MegaFile node
function getNodeHandleKeys(node: any): string[] {
  const keys: string[] = [];
  if (!node) return keys;

  // Direct node handle string (e.g. 'ty4BBRqR')
  if (node.h && typeof node.h === 'string') {
    keys.push(node.h);
  }

  // Handle downloadId attribute (can be string or array [h, key])
  if (node.downloadId) {
    if (Array.isArray(node.downloadId)) {
      keys.push(node.downloadId.join(','));
      if (node.downloadId[0] && typeof node.downloadId[0] === 'string') {
        keys.push(node.downloadId[0]);
      }
    } else if (typeof node.downloadId === 'string') {
      keys.push(node.downloadId);
      if (node.downloadId.includes(',')) {
        keys.push(node.downloadId.split(',')[0]);
      }
    }
  }

  // Direct filename string (e.g. 'video.mp4')
  if (node.name && typeof node.name === 'string') {
    keys.push(node.name);
  }

  return keys;
}

// Build a flat lookup map of file handles to nodes for instant stream retrieval
function buildHandleMap(node: any, map = new Map<string, any>()): Map<string, any> {
  if (!node) return map;

  const handleKeys = getNodeHandleKeys(node);
  for (const k of handleKeys) {
    if (k && !map.has(k)) {
      map.set(k, node);
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      buildHandleMap(child, map);
    }
  }

  return map;
}

// Promisified loadAttributes with retries & timeout resilience
async function loadAttributesWithRetry(rootFolder: any, maxAttempts = 2): Promise<any> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MEGA loadAttributes connection timed out'));
        }, 35000);

        rootFolder.loadAttributes((err: any, folder: any) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve(folder);
        });
      });
    } catch (err) {
      lastErr = err;
      const msg = String((err as any)?.message || err).toLowerCase();
      // Do not retry if link is explicitly dead/invalid
      if (msg.includes('enoent') || msg.includes('does not exist') || msg.includes('invalid key') || msg.includes('404')) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr;
}

// Fetch or reuse cached root MEGA folder node with Promise deduplication
async function getOrFetchRootFolder(megaUrl: string, forceRefresh = false): Promise<CachedRootNode> {
  if (!forceRefresh) {
    const cached = megaRootCache.get(megaUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached;
    }

    const lastFailed = failedFetchCooldowns.get(megaUrl);
    if (lastFailed && Date.now() - lastFailed < ERROR_COOLDOWN_MS) {
      throw new Error('MEGA connection recently failed. Retrying too quickly — please wait a moment.');
    }
  }

  if (pendingRootPromises.has(megaUrl) && !forceRefresh) {
    return pendingRootPromises.get(megaUrl)!;
  }

  const fetchPromise = (async () => {
    try {
      const rootFolder = MegaFile.fromURL(megaUrl);
      await loadAttributesWithRetry(rootFolder, 2);

      const handleMap = buildHandleMap(rootFolder);
      const entry: CachedRootNode = {
        rootFolder,
        timestamp: Date.now(),
        handleMap,
      };

      failedFetchCooldowns.delete(megaUrl);
      
      // LRU Eviction: Keep max entries in RAM cache to prevent OOM
      if (megaRootCache.size >= MAX_ROOT_CACHE_ENTRIES) {
        const oldestKey = megaRootCache.keys().next().value;
        if (oldestKey) megaRootCache.delete(oldestKey);
      }

      megaRootCache.set(megaUrl, entry);
      return entry;
    } catch (err) {
      failedFetchCooldowns.set(megaUrl, Date.now());
      throw err;
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
    if (!cachedRoot || !cachedRoot.handleMap) return null;

    const map = cachedRoot.handleMap;
    if (map.has(handle)) return map.get(handle);

    const decoded = decodeURIComponent(handle);
    if (map.has(decoded)) return map.get(decoded);

    // Fallback for comma-separated handle keys (e.g. handle,key -> try handle part)
    if (handle.includes(',')) {
      const part = handle.split(',')[0];
      if (map.has(part)) return map.get(part);
    }
    if (decoded.includes(',')) {
      const part = decoded.split(',')[0];
      if (map.has(part)) return map.get(part);
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

    const snapshot = getFolderSnapshot(cacheKey);
    if (snapshot && snapshot.items && snapshot.items.length > 0) {
      mediaCache.set(cacheKey, snapshot);
      // Asynchronously refresh in background without blocking current request
      getOrFetchRootFolder(megaUrl).catch(() => {});
      return snapshot;
    }
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
    saveFolderSnapshot(cacheKey, result);
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
    const detectedSubfolders: {
      name: string;
      path: string;
      itemCount: number;
      imageCount?: number;
      videoCount?: number;
      subfolderCount?: number;
    }[] = [];
    let imageCount = 0;
    let videoCount = 0;

    // Load previously captured video thumbnails and favorites concurrently from database
    const [videoThumbnails, favHandles] = await Promise.all([
      getVideoThumbnailsForAlbum(albumId),
      getFavoriteHandles(albumId),
    ]);

    if (targetNode && targetNode.children && Array.isArray(targetNode.children)) {
      for (const child of targetNode.children) {
        if (child.directory) {
          const childName = child.name || 'Subfolder';
          const fullSubPath = subfolderPath ? `${subfolderPath}/${childName}` : childName;

          let childFileCount = 0;
          let childImageCount = 0;
          let childVideoCount = 0;
          let childSubCount = 0;

          if (child.children && Array.isArray(child.children)) {
            for (const c of child.children) {
              if (c.directory) {
                childSubCount++;
              } else {
                childFileCount++;
                const cExt = (c.name || '').split('.').pop()?.toLowerCase() || '';
                if (SUPPORTED_IMAGE_EXTENSIONS.includes(cExt)) {
                  childImageCount++;
                } else if (SUPPORTED_VIDEO_EXTENSIONS.includes(cExt)) {
                  childVideoCount++;
                }
              }
            }
          }

          detectedSubfolders.push({
            name: childName,
            path: fullSubPath,
            itemCount: childFileCount,
            imageCount: childImageCount,
            videoCount: childVideoCount,
            subfolderCount: childSubCount,
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
            const rawHandle =
              (Array.isArray(child.downloadId) ? child.downloadId.join(',') : child.downloadId?.toString()) ||
              child.h ||
              child.name ||
              '';

            const handleFirstPart = rawHandle.split(',')[0];
            const hasStoredThumbnail = videoThumbnails.has(rawHandle) || videoThumbnails.has(handleFirstPart);
            const computedThumbnail = hasStoredThumbnail
              ? `/api/mega/thumbnail?albumId=${albumId}&handle=${encodeURIComponent(rawHandle)}`
              : (child as any).thumbnailUrl || undefined;
            const isFav = favHandles.has(rawHandle) || favHandles.has(handleFirstPart);
            const mediaItem: MediaItem = {
              id: `med-${rawHandle || Math.random().toString(36).substring(7)}`,
              albumId,
              folderPath: subfolderPath || '',
              fileHandle: rawHandle,
              fileName: rawName,
              mimeType: mediaType === 'IMAGE' ? `image/${ext}` : `video/${ext}`,
              mediaType,
              size: child.size || 0,
              createdAt: child.timestamp ? new Date(child.timestamp * 1000).toISOString() : new Date().toISOString(),
              thumbnailUrl: computedThumbnail,
              streamUrl: `/api/mega/stream?albumId=${albumId}&handle=${encodeURIComponent(rawHandle)}`,
              isFavorite: isFav,
            };
            items.push(mediaItem);
          }
        }
      }
    }

    // Auto-set cover image for album from first available photo
    const firstImage = items.find((m) => m.mediaType === 'IMAGE');
    if (firstImage && firstImage.streamUrl && !subfolderPath) {
      updateAlbumCoverImage(albumId, firstImage.streamUrl).catch(() => {});
    }

    const result: MegaFolderResult = {
      albumId,
      items,
      subfolders: detectedSubfolders,
      subfolderCount: detectedSubfolders.length,
      mediaCount: {
        total: items.length,
        images: imageCount,
        videos: videoCount,
      },
    };

    mediaCache.set(cacheKey, result);
    saveFolderSnapshot(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error reading MEGA folder link:', error);

    const errMsg = String((error as any)?.message || error).toLowerCase();
    const isExplicitDeadLink =
      errMsg.includes('enoent') ||
      errMsg.includes('does not exist') ||
      errMsg.includes('invalid key') ||
      errMsg.includes('404') ||
      errMsg.includes('blocked') ||
      errMsg.includes('access denied');

    // Temporary network error / cold start delay / rate limit: Fall back to persistent snapshot!
    const snapshot = getFolderSnapshot(cacheKey);
    if (snapshot) {
      console.log(`[MegaVault] Returning disk snapshot for ${cacheKey} due to temporary MEGA fetch failure.`);
      return {
        ...snapshot,
        isFromSnapshot: true,
        errorMessage: 'Using saved folder snapshot (live MEGA sync delayed).',
      };
    }

    if (isExplicitDeadLink) {
      return {
        albumId,
        items: [],
        subfolders: [],
        mediaCount: { total: 0, images: 0, videos: 0 },
        isDeadLink: true,
        errorMessage: 'MEGA folder link is currently inaccessible or deleted. Click "Refresh Album" to retry.',
      };
    }

    return {
      albumId,
      items: [],
      subfolders: [],
      mediaCount: { total: 0, images: 0, videos: 0 },
      errorMessage: 'Temporary network issue connecting to MEGA.',
    };
  }
}

/**
 * Fetch ALL media items across root and all nested subfolders recursively for an album.
 */
export async function fetchAllMegaMediaRecursive(
  albumId: string,
  megaUrl: string,
  forceRefresh = false
): Promise<{
  items: MediaItem[];
  subfolderCount: number;
  mediaCount: { total: number; images: number; videos: number };
}> {
  const cacheKey = `mega_all_media_${albumId}_${megaUrl}`;

  if (!forceRefresh) {
    const cached = mediaCache.get<any>(cacheKey);
    if (cached) return cached;

    const snapshot = getFolderSnapshot(cacheKey);
    if (snapshot && snapshot.items && snapshot.items.length > 0) {
      mediaCache.set(cacheKey, snapshot);
      return snapshot as any;
    }
  }

  // Handle mock/sample URLs
  if (!megaUrl || megaUrl.includes('example') || !megaUrl.startsWith('http')) {
    const mockItems = MOCK_MEDIA.filter((m) => m.albumId === albumId);
    const selected = mockItems.length > 0 ? mockItems : MOCK_MEDIA;
    const result = {
      items: selected,
      subfolderCount: 0,
      mediaCount: {
        total: selected.length,
        images: selected.filter((m) => m.mediaType === 'IMAGE').length,
        videos: selected.filter((m) => m.mediaType === 'VIDEO').length,
      },
    };
    mediaCache.set(cacheKey, result);
    saveFolderSnapshot(cacheKey, result as any);
    return result;
  }

  try {
    const cachedRoot = await getOrFetchRootFolder(megaUrl, forceRefresh);
    const rootFolder = cachedRoot.rootFolder;

    const [videoThumbnails, favHandles] = await Promise.all([
      getVideoThumbnailsForAlbum(albumId),
      getFavoriteHandles(albumId),
    ]);

    const allItems: MediaItem[] = [];
    let totalSubfolders = 0;
    let totalImages = 0;
    let totalVideos = 0;

    function walkNode(node: any, currentPath: string) {
      if (!node || !node.children || !Array.isArray(node.children)) return;

      for (const child of node.children) {
        if (child.directory) {
          totalSubfolders++;
          const childName = child.name || 'Subfolder';
          const nextPath = currentPath ? `${currentPath}/${childName}` : childName;
          walkNode(child, nextPath);
        } else {
          const rawName = child.name || 'unnamed_file';
          const ext = rawName.split('.').pop()?.toLowerCase() || '';

          let mediaType: MediaType | null = null;
          if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
            mediaType = 'IMAGE';
            totalImages++;
          } else if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
            mediaType = 'VIDEO';
            totalVideos++;
          }

          if (mediaType) {
            const rawHandle =
              (Array.isArray(child.downloadId) ? child.downloadId.join(',') : child.downloadId?.toString()) ||
              child.h ||
              child.name ||
              '';

            const handleFirstPart = rawHandle.split(',')[0];
            const hasStoredThumbnail = videoThumbnails.has(rawHandle) || videoThumbnails.has(handleFirstPart);
            const computedThumbnail = hasStoredThumbnail
              ? `/api/mega/thumbnail?albumId=${albumId}&handle=${encodeURIComponent(rawHandle)}`
              : (child as any).thumbnailUrl || undefined;
            const isFav = favHandles.has(rawHandle) || favHandles.has(handleFirstPart);

            const mediaItem: MediaItem = {
              id: `med-${rawHandle || Math.random().toString(36).substring(7)}`,
              albumId,
              folderPath: currentPath,
              fileHandle: rawHandle,
              fileName: rawName,
              mimeType: mediaType === 'IMAGE' ? `image/${ext}` : `video/${ext}`,
              mediaType,
              size: child.size || 0,
              createdAt: child.timestamp ? new Date(child.timestamp * 1000).toISOString() : new Date().toISOString(),
              thumbnailUrl: computedThumbnail,
              streamUrl: `/api/mega/stream?albumId=${albumId}&handle=${encodeURIComponent(rawHandle)}`,
              isFavorite: isFav,
            };
            allItems.push(mediaItem);
          }
        }
      }
    }

    walkNode(rootFolder, '');

    const result = {
      items: allItems,
      subfolderCount: totalSubfolders,
      mediaCount: {
        total: allItems.length,
        images: totalImages,
        videos: totalVideos,
      },
    };

    mediaCache.set(cacheKey, result);
    saveFolderSnapshot(cacheKey, result as any);
    return result;
  } catch (err) {
    console.error(`Error fetching recursive media for album ${albumId}:`, err);
    const snapshot = getFolderSnapshot(cacheKey);
    if (snapshot && snapshot.items && snapshot.items.length > 0) {
      return snapshot as any;
    }
    return {
      items: [],
      subfolderCount: 0,
      mediaCount: { total: 0, images: 0, videos: 0 },
    };
  }
}

/**
 * Aggregates all media items across ALL albums and all subfolders in the entire vault.
 */
export async function fetchAllVaultMedia(forceRefresh = false): Promise<{
  items: MediaItem[];
  stats: {
    totalCount: number;
    imagesCount: number;
    videosCount: number;
    albumsCount: number;
    foldersCount: number;
  };
}> {
  const vaultCacheKey = 'mega_vault_all_media';

  if (!forceRefresh) {
    const cached = mediaCache.get<any>(vaultCacheKey);
    if (cached) return cached;
  }

  const dbAlbums = await getAllAlbums();
  const allVaultItems: MediaItem[] = [];
  let totalFolders = dbAlbums.length;

  const results = await Promise.allSettled(
    dbAlbums.map(async (alb) => {
      const albumMedia = await fetchAllMegaMediaRecursive(alb.id, alb.mega_link, forceRefresh);
      totalFolders += albumMedia.subfolderCount || 0;
      return albumMedia.items.map((item) => ({
        ...item,
        albumTitle: alb.title,
      }));
    })
  );

  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      allVaultItems.push(...res.value);
    }
  }

  const imagesCount = allVaultItems.filter((i) => i.mediaType === 'IMAGE').length;
  const videosCount = allVaultItems.filter((i) => i.mediaType === 'VIDEO').length;

  const payload = {
    items: allVaultItems,
    stats: {
      totalCount: allVaultItems.length,
      imagesCount,
      videosCount,
      albumsCount: dbAlbums.length,
      foldersCount: totalFolders,
    },
  };

  mediaCache.set(vaultCacheKey, payload);
  return payload;
}

export function clearMegaFolderCache(albumId: string, megaUrl: string) {
  megaRootCache.delete(megaUrl);
  pendingRootPromises.delete(megaUrl);
  mediaCache.clear('mega_vault_all_media');
  mediaCache.clear(`mega_all_media_${albumId}_${megaUrl}`);

  // Clear all cache entries for this album (root + every subfolder path)
  const prefix = `mega_media_${albumId}_${megaUrl}_`;
  mediaCache.clearByPrefix(prefix);
  removeFolderSnapshot(prefix);
  removeFolderSnapshot(`mega_all_media_${albumId}_${megaUrl}`);
}

