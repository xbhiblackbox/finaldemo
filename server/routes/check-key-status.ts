import { Router } from "express";
import { db } from "../db.js";
import { accessKeys } from "../schema.js";
import { eq } from "drizzle-orm";
import { keyCache } from "../cache.js";

const router = Router();

router.post("/", async (req, res) => {
  const { key, deviceFingerprint } = req.body;

  if (!key) {
    return res.status(400).json({ valid: false, error: "Missing key" });
  }

  // Check cache first (5-minute TTL) — only for validation without new device fingerprint
  // Skip cache when a new fingerprint needs to be registered
  const cacheKey = `key:${key}:${deviceFingerprint || ""}`;
  const cached = keyCache.get(cacheKey);
  if (cached) {
    return res.status(cached.valid ? 200 : 403).json(cached);
  }

  try {
    const rows = await db.select().from(accessKeys).where(eq(accessKeys.key, key));
    const row = rows[0];

    if (!row) {
      const result = { valid: false, error: "Invalid access key." };
      keyCache.set(cacheKey, result, 2 * 60 * 1000); // cache invalid keys for 2 min
      return res.status(404).json(result);
    }

    if (!row.active) {
      const result = { valid: false, error: "This key has been deactivated." };
      keyCache.set(cacheKey, result, 2 * 60 * 1000);
      return res.status(403).json(result);
    }

    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      const result = { valid: false, error: "This key has expired." };
      keyCache.set(cacheKey, result, 2 * 60 * 1000);
      return res.status(403).json(result);
    }

    const fingerprints: string[] = (row.deviceFingerprints as string[]) || [];

    if (deviceFingerprint && !fingerprints.includes(deviceFingerprint)) {
      if (fingerprints.length >= (row.maxDevices || 1)) {
        const result = { valid: false, error: `Device limit reached (${row.maxDevices}). Contact support.` };
        keyCache.set(cacheKey, result, 60 * 1000); // 1 min cache for device limit
        return res.status(403).json(result);
      }

      fingerprints.push(deviceFingerprint);
      await db
        .update(accessKeys)
        .set({ deviceFingerprints: fingerprints, updatedAt: new Date() })
        .where(eq(accessKeys.key, key));
      // Invalidate cache for this key since fingerprints changed
      keyCache.del(cacheKey);
    }

    const result = { valid: true, label: row.label ?? undefined };
    keyCache.set(cacheKey, result);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[check-key-status] Error:", err);
    return res.status(500).json({ valid: false, error: "Server error" });
  }
});

export default router;
