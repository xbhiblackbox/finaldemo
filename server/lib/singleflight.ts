/**
 * Singleflight: dedupes concurrent calls for the same key.
 * If 100 users request the same IG profile at the exact same moment and the
 * cache is empty, only ONE upstream call is made — the other 99 await the
 * same in-flight promise. Massive reduction in upstream load + RapidAPI cost.
 */

const inflight = new Map<string, Promise<unknown>>();

export async function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

export function inflightSize(): number {
  return inflight.size;
}
