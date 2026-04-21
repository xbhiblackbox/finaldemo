import { useEffect, useState, useCallback, useRef } from "react";


export interface InstaReel {
  id: string;
  code: string;
  caption: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  takenAt: number;
  musicTitle?: string;
  musicIcon?: string;
}

export interface InstaProfile {
  username: string;
  fullName: string;
  bio: string;
  avatarUrl: string;
  isVerified: boolean;
  followers: number;
  following: number;
  postsCount: number;
  externalUrl?: string;
  category?: string;
}

export interface InstaHighlight {
  id: string;
  name: string;
  image: string;
}

export interface InstaScrapeResult {
  username: string;
  profile?: InstaProfile;
  reels?: InstaReel[];
  posts?: InstaReel[];
  highlights?: InstaHighlight[];
  profileOk?: boolean;
  reelsOk?: boolean;
  postsOk?: boolean;
  highlightsOk?: boolean;
}

const USERNAME_KEY = "ig_connected_username";

// Module-level cache: stores the last successfully synced live avatar URL so
// BottomNav / HomeScreen can read it synchronously on mount even before the
// first ig-profile-synced event fires.
let _liveAvatarUrl: string = "";
export const getLiveAvatar = (): string => _liveAvatarUrl;
export const setLiveAvatar = (avatar: string) => {
  _liveAvatarUrl = avatar || "";
};

export function getConnectedUsername(): string {
  return localStorage.getItem(USERNAME_KEY) || "";
}

export function setConnectedUsername(username: string) {
  const clean = username.trim().replace(/^@/, "");
  if (clean) localStorage.setItem(USERNAME_KEY, clean);
  else localStorage.removeItem(USERNAME_KEY);
}

export function disconnectInstagram() {
  localStorage.removeItem(USERNAME_KEY);
}

export async function fetchInstagramData(
  username: string,
  type: "profile" | "reels" | "posts" | "highlights" | "all" = "all",
): Promise<InstaScrapeResult> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean) throw new Error("Username required");

  const res = await fetch("/api/instagram-scraper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: clean, type }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─────────── Cache (localStorage, 10 min TTL) ───────────
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Bump version when normalizer shape changes to invalidate old caches
const cacheKey = (u: string, t: string) => `ig_cache_v3:${u}:${t}`;

interface CacheEntry { data: InstaScrapeResult; ts: number; }

function readCache(u: string, t: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(u, t));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry?.data || !entry?.ts) return null;
    return entry;
  } catch { return null; }
}

function writeCache(u: string, t: string, data: InstaScrapeResult) {
  try {
    localStorage.setItem(cacheKey(u, t), JSON.stringify({ data, ts: Date.now() } as CacheEntry));
  } catch { /* quota — ignore */ }
}

export function clearInstagramCache(username?: string) {
  try {
    // Clear all old + current caches
    const prefixes = username
      ? [`ig_cache_v1:${username.replace(/^@/, "")}:`, `ig_cache_v2:${username.replace(/^@/, "")}:`, `ig_cache_v3:${username.replace(/^@/, "")}:`]
      : [`ig_cache_v1:`, `ig_cache_v2:`, `ig_cache_v3:`];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && prefixes.some(p => k.startsWith(p))) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

/**
 * Live Instagram data hook with 10-minute cache.
 * - Reads cache first → instant display if fresh (< 10 min)
 * - Background refresh if stale
 * - refetch(true) forces network call (manual refresh override)
 */
export function useInstagramData(username?: string, type: "profile" | "reels" | "posts" | "highlights" | "all" = "all") {
  const u = username ?? getConnectedUsername();
  const [data, setData] = useState<InstaScrapeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const reqId = useRef(0);

  const refetch = useCallback(async (force: boolean = false) => {
    if (!u) {
      setData(null);
      setError(null);
      setCachedAt(null);
      return;
    }

    // Try cache first (unless force)
    if (!force) {
      const cached = readCache(u, type);
      if (cached) {
        setData(cached.data);
        setCachedAt(cached.ts);
        setError(null);
        const isFresh = Date.now() - cached.ts < CACHE_TTL_MS;
        if (isFresh) return; // skip network
        // stale → fall through and refresh in background
      }
    }

    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchInstagramData(u, type);
      if (myReq !== reqId.current) return; // stale
      setData(res);
      writeCache(u, type, res);
      setCachedAt(Date.now());
    } catch (e: any) {
      if (myReq !== reqId.current) return;
      setError(e?.message || String(e));
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, [u, type]);

  useEffect(() => {
    refetch(false);
  }, [refetch]);

  // Sync IG profile (avatar/full name/bio/followers/highlights) into mockAccounts so HomeScreen, BottomNav, ProfileScreen update too.
  useEffect(() => {
    if (!u) return;
    if (data?.profile) syncIgProfileToMockAccounts(u, data.profile);
    if (data?.highlights) syncIgHighlightsToMockAccounts(u, data.highlights);
  }, [u, data]);

  return { data, loading, error, refetch, username: u, cachedAt };
}

// Sync live IG profile data into the in-memory mockAccounts + currentUser, then notify listeners.
async function syncIgProfileToMockAccounts(username: string, profile: InstaProfile) {
  try {
    const mod = await import("@/data/mockData");
    const acc = mod.mockAccounts[username];
    if (!acc) return;
    const proxied = proxyIgImage(profile.avatarUrl);
    const hasManualAvatar = /^(data:|blob:)/.test(acc.profile.avatar || "");
    let changed = false;
    if (!hasManualAvatar && proxied && acc.profile.avatar !== proxied) { acc.profile.avatar = proxied; changed = true; }
    if (profile.fullName && acc.profile.fullName !== profile.fullName) { acc.profile.fullName = profile.fullName; changed = true; }
    if (profile.bio && acc.profile.bio !== profile.bio) { acc.profile.bio = profile.bio; changed = true; }
    if (profile.followers && acc.profile.followers !== profile.followers) { acc.profile.followers = profile.followers; changed = true; }
    if (profile.following && acc.profile.following !== profile.following) { acc.profile.following = profile.following; changed = true; }
    if (profile.postsCount && acc.profile.posts !== profile.postsCount) { acc.profile.posts = profile.postsCount; changed = true; }
    // Website (link in bio) — if IG has no link, clear default to avoid showing stale "Organicsmm.online"
    const igLink = (profile.externalUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (acc.profile.website !== igLink) { acc.profile.website = igLink; changed = true; }
    // Category — clear if IG has none
    if ((acc as any).category !== (profile.category || "")) { (acc as any).category = profile.category || ""; changed = true; }

    // Mirror into currentUser for components that read it directly (BottomNav, HomeScreen).
    if (mod.currentUser) {
      if (!hasManualAvatar && proxied) mod.currentUser.avatar = proxied;
      if (profile.fullName) mod.currentUser.fullName = profile.fullName;
      if (profile.bio) mod.currentUser.bio = profile.bio;
      if (profile.followers) mod.currentUser.followers = profile.followers;
      if (profile.following) mod.currentUser.following = profile.following;
      if (profile.postsCount) mod.currentUser.posts = profile.postsCount;
      mod.currentUser.website = igLink;
    }

    // If user uploaded a manual avatar (data:/blob:), respect it everywhere —
    // do NOT broadcast the IG avatar over it.
    const broadcastAvatar = hasManualAvatar
      ? acc.profile.avatar
      : (proxied || acc.profile.avatar || mod.currentUser.avatar);
    if (broadcastAvatar) _liveAvatarUrl = broadcastAvatar;

    if (broadcastAvatar) {
      window.dispatchEvent(new CustomEvent("ig-profile-synced", {
        detail: { username, avatar: broadcastAvatar },
      }));
    }
  } catch { /* ignore */ }
}

// Sync live IG highlights into mockAccounts (proxied images for CORS).
async function syncIgHighlightsToMockAccounts(username: string, highlights: InstaHighlight[]) {
  try {
    const mod = await import("@/data/mockData");
    const acc = mod.mockAccounts[username];
    if (!acc) return;
    // Empty array → user has no highlights → clear them.
    const next = highlights.map(h => ({ name: h.name, image: proxyIgImage(h.image) || h.image }));
    const prev = acc.highlights || [];
    const same = prev.length === next.length && prev.every((p, i) => p.name === next[i].name && p.image === next[i].image);
    if (!same) {
      acc.highlights = next;
      window.dispatchEvent(new CustomEvent("ig-profile-synced", { detail: { username } }));
    }
  } catch { /* ignore */ }
}

// ─────────── Helpers ───────────

/** Proxy Instagram CDN images through our server to bypass referrer/CORS blocks. */
export function proxyIgImage(url: string | undefined | null): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url; // Do not proxy local/relative paths
  if (url.includes("images.weserv.nl")) return url; // Avoid double proxying
  // Bypass Origin IP blocks using a global caching proxy (weserv.nl)
  // This solves 403 Forbidden issues when IG URLs generated in US are opened in India
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
}

export function formatCount(n: number): string {
  if (!n || isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

/** Aggregate totals across reels + posts. */
export function aggregateInsights(d: InstaScrapeResult | null) {
  const all = [...(d?.reels || []), ...(d?.posts || [])];
  const views = all.reduce((s, r) => s + (r.views || 0), 0);
  const likes = all.reduce((s, r) => s + (r.likes || 0), 0);
  const comments = all.reduce((s, r) => s + (r.comments || 0), 0);
  const shares = all.reduce((s, r) => s + (r.shares || 0), 0);
  return {
    views,
    likes,
    comments,
    shares,
    interactions: likes + comments + shares,
    contentShared: all.length,
    followers: d?.profile?.followers || 0,
    following: d?.profile?.following || 0,
    postsCount: d?.profile?.postsCount || all.length,
  };
}
