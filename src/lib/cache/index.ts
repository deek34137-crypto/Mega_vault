interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes in ms

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.defaultTTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
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
  private maxEntries = 250; // Store up to 250 image buffers in RAM for instant 5ms retrieval
  private ttlMs = 60 * 60 * 1000; // 1 hour TTL

  get(key: string): ImageCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(key: string, buffer: Buffer, mimeType: string): void {
    if (this.cache.size >= this.maxEntries) {
      // LRU eviction: delete oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { buffer, mimeType, timestamp: Date.now() });
  }

  clearAll(): void {
    this.cache.clear();
  }
}

export const imageBufferCache = new ImageBufferCache();

