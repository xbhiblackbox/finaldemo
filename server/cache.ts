/**
 * Bounded TTL cache with LRU eviction.
 * Used to avoid hammering RapidAPI and the DB on every request.
 *
 * Memory-safe: never grows beyond `maxEntries`. Oldest-accessed entry
 * is evicted when full. Expired entries are also swept periodically.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 1000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    setInterval(() => this.sweep(), 5 * 60 * 1000).unref();
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // LRU: re-insert to mark as recently used
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T, ttlMs?: number): void {
    // Evict oldest if at capacity (Map preserves insertion order)
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { data, expiresAt: Date.now() + (ttlMs ?? this.ttlMs) });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// Instagram API cache — 60 minutes, up to 5k profiles (~few MB) to reduce API hits
export const igCache = new TtlCache<unknown>(60 * 60 * 1000, 5000);

// Key validation cache — 5 minutes, up to 5k keys
export const keyCache = new TtlCache<{ valid: boolean; label?: string; error?: string }>(5 * 60 * 1000, 5000);

// Image proxy cache — 60 minutes, up to 500 images (browser cache handles most)
export const imgCache = new TtlCache<Buffer>(60 * 60 * 1000, 500);
