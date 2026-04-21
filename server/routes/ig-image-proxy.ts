import { Router } from "express";
import { singleflight } from "../lib/singleflight.js";

const router = Router();

const ALLOWED_HOSTS = ["cdninstagram.com", "fbcdn.net", "instagram.com"];
const FETCH_TIMEOUT_MS = 10_000;

router.get("/", async (req, res) => {
  const target = req.query.url as string;
  if (!target) {
    return res.status(400).json({ error: "Missing 'url' query param" });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  if (!ALLOWED_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  const url = parsed.toString();
  try {
    // Singleflight per-URL: if 50 users hit the same image at once, fetch once.
    const result = await singleflight(`img:${url}`, async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const upstream = await fetch(url, {
          signal: ctrl.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
            Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
          },
        });
        if (!upstream.ok) {
          return { ok: false as const, status: upstream.status };
        }
        const ct = upstream.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await upstream.arrayBuffer());
        return { ok: true as const, ct, buf };
      } finally {
        clearTimeout(timer);
      }
    });

    if (!result.ok) {
      return res.status(502).json({ error: `Upstream ${result.status}` });
    }

    res.set("Content-Type", result.ct);
    // 1 day browser/CDN cache. Profile/post images are content-addressed (versioned URLs).
    res.set("Cache-Control", "public, max-age=86400, s-maxage=86400, immutable");
    res.set("Access-Control-Allow-Origin", "*");
    return res.send(result.buf);
  } catch (err) {
    console.error("[ig-image-proxy] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
