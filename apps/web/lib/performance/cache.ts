type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const globalForTtlCache = globalThis as unknown as {
  ttlCache?: Map<string, CacheEntry<unknown>>;
};

const store = globalForTtlCache.ttlCache ?? new Map<string, CacheEntry<unknown>>();

if (process.env.NODE_ENV !== "production") {
  globalForTtlCache.ttlCache = store;
}

export function cacheKey(parts: Array<string | number | boolean | null | undefined>) {
  return parts.map((part) => String(part ?? "none")).join(":");
}

export async function getOrSetCache<T>(key: string, ttlSeconds: number, factory: () => Promise<T>) {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  const value = await factory();
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}

export function invalidateCache(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function privateCacheHeaders(seconds: number) {
  return {
    "Cache-Control": `private, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`,
    Vary: "Cookie, Authorization",
  };
}
