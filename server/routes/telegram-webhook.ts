import { Router } from "express";
import { db } from "../db.js";
import { accessKeys } from "../schema.js";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_CHAT_IDS = process.env.TELEGRAM_ADMIN_CHAT_ID ? process.env.TELEGRAM_ADMIN_CHAT_ID.split(",") : [];

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}-${part()}`;
}

function parseDuration(input: string): { days: number; label: string } | null {
  if (/^\d+$/.test(input)) {
    const days = parseInt(input);
    if (days <= 0) return null;
    return { days, label: `${days} day${days > 1 ? "s" : ""}` };
  }
  const map: Record<string, { days: number; label: string }> = {
    lifetime: { days: 0, label: "Lifetime" },
    lt: { days: 0, label: "Lifetime" },
  };
  const match = input.toLowerCase().match(/^(\d+)d$/);
  if (match) {
    const days = parseInt(match[1]);
    if (days <= 0) return null;
    return { days, label: `${days} day${days > 1 ? "s" : ""}` };
  }
  return map[input.toLowerCase()] || null;
}

async function sendToAllAdmins(botToken: string, chatIds: string[], text: string) {
  await Promise.allSettled(
    chatIds.map((id) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id.trim(), text, parse_mode: "HTML" }),
      })
    )
  );
}

async function sendTo(botToken: string, chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

router.post("/", async (req, res) => {
  // Always respond 200 immediately so Telegram doesn't retry
  res.status(200).send("ok");

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  try {
    const update = req.body;
    const message = update?.message;
    if (!message?.text) return;

    const chatId = message.chat.id;
    const text = (message.text as string).trim();

    if (!ADMIN_CHAT_IDS.includes(String(chatId))) {
      await sendTo(botToken, chatId, "⛔ Unauthorized.");
      return;
    }

    // /gen <name> <duration> [devices]
    if (text.startsWith("/gen") || text.startsWith("/generate")) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS,
          `❌ <b>Usage:</b>\n<code>/gen &lt;name&gt; &lt;days&gt;</code>\n\n<b>Examples:</b>\n<code>/gen Ahmed 7</code>\n<code>/gen Ali 30 2</code>\n<code>/gen VIP lifetime</code>`
        );
        return;
      }

      const userName = parts[1];
      const durationInput = parts[2];
      const maxDevices = parseInt(parts[3] || "1") || 1;
      const duration = parseDuration(durationInput);

      if (!duration) {
        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS,
          `❌ Invalid duration: <code>${durationInput}</code>\n\nSirf number daalo (7, 30...) ya "lifetime"`
        );
        return;
      }

      const key = generateKey();
      const now = new Date();
      const expiresAt = duration.days > 0
        ? new Date(now.getTime() + duration.days * 24 * 60 * 60 * 1000)
        : null;

      try {
        await db.insert(accessKeys).values({
          key,
          label: userName,
          active: true,
          expiresAt,
          maxDevices,
        });

        const expLine = expiresAt
          ? `📅 <b>Exp:</b> ${expiresAt.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
          : `📅 <b>Exp:</b> Never (Lifetime)`;

        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS,
          `✅ <b>Key Generated for [${userName}]</b>\n\n🔑 <code>${key}</code>\n⏳ <b>Duration:</b> ${duration.label}\n${expLine}\n📱 <b>Max Devices:</b> ${maxDevices}\n\n<i>Key is ready to use!</i>`
        );
      } catch (dbErr: any) {
        const fullErr = dbErr.cause ? `${dbErr.message}\nCause: ${dbErr.cause.message}` : dbErr.message;
        const detail = dbErr.detail ? `\nDetail: ${dbErr.detail}` : '';
        const code = dbErr.code ? `\nCode: ${dbErr.code}` : '';
        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, `❌ <b>Database Error:</b>\n<pre>${fullErr}${detail}${code}</pre>`);
      }
      return;
    }

    // /list
    if (text.startsWith("/list")) {
      try {
        const keys = await db.select().from(accessKeys);
        keys.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        const limited = keys.slice(0, 30);

        if (limited.length === 0) {
          await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, "📭 No keys found.");
          return;
        }

        const activeKeys = limited.filter((k) => k.active);
        const revokedKeys = limited.filter((k) => !k.active);

        const formatKey = (k: typeof activeKeys[0], i: number) => {
          const devices = (k.deviceFingerprints as string[])?.length || 0;
          const exp = k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "Lifetime";
          const status = k.active ? "✅" : "🚫";
          return `${i + 1}. ${status} <b>${k.label}</b>\n   <code>${k.key}</code>\n   📅 ${exp} | 📱 ${devices} device(s)`;
        };

        let msg = `📋 <b>All Keys (${limited.length})</b>\n\n`;
        if (activeKeys.length > 0) msg += `<b>✅ Active (${activeKeys.length})</b>\n\n${activeKeys.map(formatKey).join("\n\n")}\n\n`;
        if (revokedKeys.length > 0) msg += `<b>🚫 Revoked (${revokedKeys.length})</b>\n\n${revokedKeys.map(formatKey).join("\n\n")}`;

        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, msg.trim());
      } catch (dbErr: any) {
        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, `❌ <b>Database Error in /list:</b>\n<pre>${dbErr.message}</pre>`);
      }
      return;
    }

    // /revoke <key>
    if (text.startsWith("/revoke")) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, "❌ Usage: <code>/revoke KEY-CODE</code>");
        return;
      }

      const targetKey = parts[1].toUpperCase();

      try {
        const rows = await db.select().from(accessKeys).where(eq(accessKeys.key, targetKey));
        const existing = rows[0];

        if (!existing) {
          await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, `❌ Key <code>${targetKey}</code> not found.`);
          return;
        }
        if (!existing.active) {
          await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, `⚠️ Key <code>${targetKey}</code> (${existing.label}) is already revoked.`);
          return;
        }

        await db.update(accessKeys).set({ active: false, updatedAt: new Date() }).where(eq(accessKeys.key, targetKey));

        const expLine = existing.expiresAt
          ? `📅 Expiry: ${new Date(existing.expiresAt).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
          : `📅 Expiry: Lifetime`;

        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS,
          `🚫 <b>Key Revoked!</b>\n\n🔑 <code>${targetKey}</code>\n👤 ${existing.label}\n${expLine}\n\n<i>This key is now deactivated.</i>`
        );
      } catch (dbErr: any) {
        await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, `❌ <b>Database Error in /revoke:</b>\n<pre>${dbErr.message}</pre>`);
      }
      return;
    }

    // /help or /start
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await sendToAllAdmins(botToken, ADMIN_CHAT_IDS,
        `🤖 <b>Real Insights Key Manager</b>\n\n` +
        `<b>Commands:</b>\n` +
        `📌 <code>/gen name days [devices]</code>\n   Generate a new key\n\n` +
        `📋 <code>/list</code>\n   List all keys\n\n` +
        `🚫 <code>/revoke KEY-CODE</code>\n   Deactivate a key\n\n` +
        `<b>Examples:</b>\n` +
        `<code>/gen Ahmed 7</code> → 7 days\n` +
        `<code>/gen Ali 30 2</code> → 30 days, 2 devices\n` +
        `<code>/gen VIP lifetime</code> → permanent`
      );
      return;
    }

    await sendToAllAdmins(botToken, ADMIN_CHAT_IDS, "🤔 Unknown command. Send /help for usage.");
  } catch (err) {
    console.error("[telegram-webhook] Error:", err);
  }
});

export default router;
