import "dotenv/config";
import express from "express";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { pool, bootstrapSchema } from "./db.js";
import checkKeyRouter from "./routes/check-key-status.js";
import instagramScraperRouter from "./routes/instagram-scraper.js";
import igImageProxyRouter from "./routes/ig-image-proxy.js";
import telegramRouter from "./routes/telegram.js";
import telegramWebhookRouter from "./routes/telegram-webhook.js";
import reelsDataRouter from "./routes/reels-data.js";
import storageRouter from "./routes/storage.js";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || "5001", 10);

// Replit runs behind a reverse proxy — trust it so rate limiters can read the real client IP
app.set("trust proxy", 1);

// Gzip compression — reduces response size by ~70%
app.use(compression());

// JSON bodies are small (key checks, scraper params, edits) — 2mb is plenty.
// Large file uploads use multer (separate parser) with its own 200mb limit.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// --- Rate limiters ---

// General API: 200 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Instagram scraper: 30 requests per minute per IP (expensive API calls)
const scraperLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many Instagram requests. Please wait a moment." },
});

// Key check: 20 attempts per minute per IP (brute-force protection)
const keyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, error: "Too many attempts. Please wait and try again." },
});

app.use("/api", generalLimiter);

// API Routes
app.use("/api/check-key-status", keyLimiter, checkKeyRouter);
app.use("/api/instagram-scraper", scraperLimiter, instagramScraperRouter);
app.use("/api/ig-image-proxy", igImageProxyRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/telegram-webhook", telegramWebhookRouter);
app.use("/api/reels-data", reelsDataRouter);
app.use("/api/storage", storageRouter);

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Serve built frontend in production with aggressive caching for hashed assets.
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        // Vite emits hashed filenames in /assets — safe to cache forever
        if (/\/assets\/.*\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|avif)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith("index.html")) {
          // index.html must always be revalidated so users get latest build
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );
  app.get(/.*/, (_req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const server = createServer(app);

// Long-running upstream calls (RapidAPI / image proxy) sometimes need >2 min.
// Default keep-alive (5s) is too aggressive behind a reverse proxy and can drop
// connections mid-response under load. Bump to 65s to outlive most LB timeouts.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`[server] Listening on port ${PORT}`);
  await bootstrapSchema();
});

// Graceful shutdown: drain in-flight requests + close DB pool cleanly
const shutdown = (signal: string) => {
  console.log(`[server] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
