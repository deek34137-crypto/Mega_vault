interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes in ms
  private maxEntries = 500; // Maximum cache entry capacity

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.defaultTTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order on access
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(key: string): void {
    this.cache.delete(key);
  }

  clearByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clearAll(): void {
    this.cache.clear();
  }
}

export const mediaCache = new MemoryCache();

interface ImageCacheEntry {
  buffer: Buffer;
  mimeType: string;
  timestamp: number;
}

class ImageBufferCache {
  private cache = new Map<string, ImageCacheEntry>();
  private maxEntries = 250;
  private maxTotalBytes = 100 * 1024 * 1024; // 100 MB max total RAM budget
  private currentTotalBytes = 0;
  private ttlMs = 60 * 60 * 1000; // 1 hour TTL

  get(key: string): ImageCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.currentTotalBytes -= entry.buffer.length;
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(key: string, buffer: Buffer, mimeType: string): void {
    // If updating an existing key, subtract old buffer size first
    const existing = this.cache.get(key);
    if (existing) {
      this.currentTotalBytes -= existing.buffer.length;
      this.cache.delete(key);
    }

    // Evict oldest items until under byte limit and count limit
    while (
      (this.currentTotalBytes + buffer.length > this.maxTotalBytes || this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry) {
          this.currentTotalBytes -= oldestEntry.buffer.length;
        }
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.cache.set(key, { buffer, mimeType, timestamp: Date.now() });
    this.currentTotalBytes += buffer.length;
  }

  clearAll(): void {
    this.cache.clear();
    this.currentTotalBytes = 0;
  }
}

export const imageBufferCache = new ImageBufferCache();

interface VideoChunkEntry {
  buffer: Buffer;
  mimeType: string;
  fileSize: number;
  timestamp: number;
}

class VideoChunkCache {
  private cache = new Map<string, VideoChunkEntry>();
  private maxEntries = 40;
  private maxTotalBytes = 150 * 1024 * 1024; // 150 MB max total RAM budget
  private currentTotalBytes = 0;
  private ttlMs = 2 * 60 * 60 * 1000; // 2 hours TTL

  get(key: string): VideoChunkEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.currentTotalBytes -= entry.buffer.length;
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(key: string, buffer: Buffer, mimeType: string, fileSize: number): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.currentTotalBytes -= existing.buffer.length;
      this.cache.delete(key);
    }

    while (
      (this.currentTotalBytes + buffer.length > this.maxTotalBytes || this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry) {
          this.currentTotalBytes -= oldestEntry.buffer.length;
        }
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.cache.set(key, { buffer, mimeType, fileSize, timestamp: Date.now() });
    this.currentTotalBytes += buffer.length;
  }

  clearAll(): void {
    this.cache.clear();
    this.currentTotalBytes = 0;
  }
}

export const videoChunkCache = new VideoChunkCache();


