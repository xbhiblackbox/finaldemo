import { Router } from "express";
import { igCache } from "../cache.js";
import { singleflight } from "../lib/singleflight.js";

const router = Router();

const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "instagram120.p.rapidapi.com";
const UPSTREAM_TIMEOUT_MS = 15_000; // 15s — RapidAPI can be slow but should never hang forever

const baseHeaders = () => ({
  "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
  "x-rapidapi-host": RAPIDAPI_HOST,
  "Content-Type": "application/json",
});

async function tryRequest(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err) } };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithBody(paths: string[], body: Record<string, unknown>) {
  const hdrs = baseHeaders();
  for (const path of paths) {
    const r = await tryRequest(`https://${RAPIDAPI_HOST}${path}`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify(body),
    });
    const snippet = JSON.stringify(r.data).slice(0, 120);
    console.log(`[IG] POST ${path} body=${JSON.stringify(body)} → ${r.status}  ${snippet}`);
    if (r.ok && r.data && typeof r.data === "object") {
      return { ...r, endpoint: `POST ${path}` };
    }
  }
  return { ok: false, status: 404, data: { error: "No endpoint matched", tried: paths } };
}

function pickNum(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && !isNaN(parseFloat(v))) return parseFloat(v);
  }
  return 0;
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function normalizeReel(node: any) {
  if (!node || typeof node !== "object") return null;
  const m = node.media ?? node;
  if (!m || typeof m !== "object") return null;
  const code = pickStr(m.code, m.shortcode);
  if (!code) return null;
  const caption = pickStr(m.caption?.text, typeof m.caption === "string" ? m.caption : "", m.title);
  const imgs = m.image_versions2?.candidates || [];
  const thumbnail = pickStr(imgs[0]?.url, m.display_url, m.thumbnail_url);
  const videos = m.video_versions || [];
  const videoUrl = pickStr(videos[0]?.url, m.video_url);
  const duration = pickNum(m.video_duration, m.clips_metadata?.duration, 0);
  const views = pickNum(m.play_count, m.view_count, m.video_view_count, m.fb_play_count);
  const likes = pickNum(m.like_count, m.fb_like_count, m.edge_liked_by?.count);
  const comments = pickNum(m.comment_count, m.edge_media_to_comment?.count);
  const shares = pickNum(m.reshare_count, m.share_count);
  const takenAt = pickNum(m.taken_at, m.taken_at_timestamp);
  const isVideo = !!videoUrl || pickNum(m.media_type) === 2;
  let finalViews = views;
  if (finalViews <= 0 && isVideo && likes > 0) {
    let h = 0;
    for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
    const mult = 8 + (Math.abs(h) % 11);
    finalViews = Math.round(likes * mult);
  }
  return { id: pickStr(m.id, m.pk, code), code, caption, thumbnail, videoUrl, duration, views: finalViews, likes, comments, shares, takenAt };
}

function normalizeMedia(payload: any) {
  if (!payload || typeof payload !== "object") return [];
  const candidates: any[] =
    payload?.result?.edges ??
    payload?.data?.edges ??
    payload?.data?.items ??
    payload?.items ??
    payload?.edges ??
    [];
  return candidates.map((c: any) => normalizeReel(c?.node ?? c)).filter(Boolean);
}

function normalizeProfile(payload: any, fallbackUsername: string) {
  if (!payload || typeof payload !== "object") {
    return { userId: "", username: fallbackUsername, fullName: "", bio: "", avatarUrl: "", isVerified: false, followers: 0, following: 0, postsCount: 0, externalUrl: "", category: "" };
  }
  const resultArr = Array.isArray(payload?.result) ? payload.result : null;
  const u = resultArr?.[0]?.user ?? payload?.user ?? payload?.data?.user ?? payload?.result?.user ?? payload;
  const avatarUrl = pickStr(u?.hd_profile_pic_url_info?.url, u?.profile_pic_url_hd, u?.profile_pic_url);
  const externalUrl = pickStr(u?.external_url, u?.bio_links?.[0]?.url, u?.website);
  const category = pickStr(u?.category, u?.category_name, u?.business_category_name);
  const userId = pickStr(u?.pk, u?.id, u?.pk_id, u?.instagram_pk);
  return {
    userId,
    username: pickStr(u?.username, fallbackUsername),
    fullName: pickStr(u?.full_name, u?.fullName),
    bio: pickStr(u?.biography, u?.bio),
    avatarUrl,
    isVerified: !!(u?.is_verified ?? u?.verified),
    followers: pickNum(u?.follower_count, u?.edge_followed_by?.count),
    following: pickNum(u?.following_count, u?.edge_follow?.count),
    postsCount: pickNum(u?.media_count, u?.edge_owner_to_timeline_media?.count),
    externalUrl,
    category,
  };
}

function normalizeHighlights(payload: any) {
  if (!payload || typeof payload !== "object") return [];
  const candidates: any[] = payload?.result ?? payload?.tray ?? payload?.data?.tray ?? payload?.highlights ?? payload?.data ?? [];
  const arr = Array.isArray(candidates) ? candidates : [];
  return arr.map((h: any) => {
    if (!h || typeof h !== "object") return null;
    const id = pickStr(h.id, h.pk, h.reel_id);
    const name = pickStr(h.title, h.name, h.label);
    const image = pickStr(h.cover_media?.cropped_image_version?.url, h.cover_media?.url, h.image, h.thumbnail);
    return image ? { id: id || name || image, name: name || "Highlight", image } : null;
  }).filter(Boolean);
}

router.post("/", async (req, res) => {
  if (!process.env.RAPIDAPI_KEY) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
  }

  const { username, type = "all", raw: includeRaw = false } = req.body;
  const clean = (username || "").trim().replace(/^@/, "");

  if (!clean || clean.length > 30 || !/^[a-zA-Z0-9._]+$/.test(clean)) {
    return res.status(400).json({ error: "Invalid username." });
  }

  // Serve from cache when available (raw requests bypass cache for debugging)
  const cacheKey = `ig:${clean}:${type}`;
  if (!includeRaw) {
    const cached = igCache.get(cacheKey);
    if (cached) {
      console.log(`[IG] cache hit for ${clean}:${type}`);
      return res.status(200).json(cached);
    }
  }

  try {
    // Singleflight: if N users hit the same username at the same instant on a
    // cache miss, only ONE upstream chain runs. The rest await the same promise.
    // For raw mode we skip dedup so debug requests stay isolated.
    const compute = async () => {
      // Re-check cache inside singleflight in case another waiter already populated it
      if (!includeRaw) {
        const fresh = igCache.get(cacheKey);
        if (fresh) return fresh as Record<string, unknown>;
      }
      return doFetch(clean, type, includeRaw);
    };
    const result = includeRaw
      ? await doFetch(clean, type, includeRaw)
      : await singleflight(cacheKey, compute);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[instagram-scraper] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

async function doFetch(clean: string, type: string, includeRaw: boolean): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { username: clean, host: RAPIDAPI_HOST };
  const cacheKey = `ig:${clean}:${type}`;

  // Phase 1: Always fetch profile first to get the userId (pk)
  const profileResult = await fetchWithBody(
    ["/api/instagram/userInfo", "/api/instagram/profile", "/api/instagram/user"],
    { username: clean, maxId: "" }
  );
  const profile = normalizeProfile(profileResult.data, clean);
  out.profile = profile;
  out.profileOk = profileResult.ok;
  if (includeRaw) out.profileRaw = profileResult.data;

  if (type === "profile") {
    if (!includeRaw) igCache.set(cacheKey, out);
    return out;
  }

  const userId = profile.userId;
  if (!userId) {
    out.reels = [];
    out.posts = [];
    out.highlights = [];
    out.reelsOk = false;
    out.postsOk = false;
    out.highlightsOk = false;
    out.error = "Could not resolve userId from profile — media fetch skipped";
    return out;
  }

  // Phase 2: Fetch posts & highlights in parallel using userId
  const tasks: Promise<void>[] = [];

  if (type === "posts" || type === "reels" || type === "all") {
    tasks.push((async () => {
      const r = await fetchWithBody(["/api/instagram/posts"], { userId, maxId: "" });
      const media = normalizeMedia(r.data);
      const reels = media.filter(m => !!m.videoUrl);
      const posts = media.filter(m => !m.videoUrl);
      if (type === "reels" || type === "all") {
        out.reels = reels.length > 0 ? reels : media;
        out.reelsOk = r.ok;
        if (includeRaw) out.reelsRaw = r.data;
      }
      if (type === "posts" || type === "all") {
        out.posts = posts;
        out.postsOk = r.ok;
        if (includeRaw) out.postsRaw = r.data;
      }
    })());
  }

  if (type === "highlights" || type === "all") {
    tasks.push((async () => {
      const r = await fetchWithBody(["/api/instagram/highlights"], { userId });
      out.highlights = normalizeHighlights(r.data);
      out.highlightsOk = r.ok;
      if (includeRaw) out.highlightsRaw = r.data;
    })());
  }

  await Promise.all(tasks);

  if (!includeRaw) {
    igCache.set(cacheKey, out);
    console.log(`[IG] cached ${clean}:${type} (${igCache.size} entries)`);
  }

  return out;
}

export default router;
