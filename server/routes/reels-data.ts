import { Router } from "express";
import { db } from "../db.js";
import { reelsData } from "../schema.js";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/reels-data?account=xxx
router.get("/", async (req, res) => {
  const account = req.query.account as string;
  if (!account) return res.status(400).json({ error: "account required" });

  try {
    const rows = await db.select().from(reelsData).where(eq(reelsData.account, account));
    return res.json(rows);
  } catch (err) {
    console.error("[reels-data] GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/reels-data (upsert)
router.post("/", async (req, res) => {
  const { account, post_index, data } = req.body;
  if (!account || post_index == null || !data) {
    return res.status(400).json({ error: "account, post_index, data required" });
  }

  try {
    const existing = await db
      .select()
      .from(reelsData)
      .where(and(eq(reelsData.account, account), eq(reelsData.postIndex, post_index)));

    if (existing.length > 0) {
      const merged = { ...(existing[0].data as object), ...data };
      await db
        .update(reelsData)
        .set({ data: merged, updatedAt: new Date() })
        .where(and(eq(reelsData.account, account), eq(reelsData.postIndex, post_index)));
    } else {
      await db.insert(reelsData).values({
        account,
        postIndex: post_index,
        data,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[reels-data] POST error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
