import { Router } from "express";

const router = Router();

const ADMIN_CHAT_IDS = process.env.TELEGRAM_ADMIN_CHAT_ID ? process.env.TELEGRAM_ADMIN_CHAT_ID.split(",") : [];

async function sendToAllAdmins(botToken: string, chatIds: string[], text: string) {
  const results = await Promise.allSettled(
    chatIds.map((id) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id.trim(), text, parse_mode: "HTML" }),
      })
    )
  );
  return results;
}

router.post("/", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: "Telegram not configured" });
  }

  try {
    await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, text);
    return res.status(200).json({ ok: true, sent_to: ADMIN_CHAT_IDS.length });
  } catch (err) {
    console.error("[telegram] Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
