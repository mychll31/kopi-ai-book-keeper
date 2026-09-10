import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { user, sameOrigin, digest } from "@/lib/auth";
import { encrypt, decrypt, encryptionReady } from "@/lib/integration-secrets";
import { telegram } from "@/lib/telegram";
export const maxDuration = 60;
export async function GET() {
  const account = await user();
  if (!account)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  const row = (
    await (
      await db()
    ).execute({
      sql: "SELECT i.*,g.api_key AS groq_key,g.model AS groq_model FROM integrations i LEFT JOIN groq_settings g ON g.user_id=i.user_id WHERE i.user_id=?",
      args: [account.id],
    })
  ).rows[0];
  return Response.json(
    {
      ready: encryptionReady(),
      groqConfigured: !!row?.groq_key,
      model: row?.groq_model || "qwen/qwen3.6-27b",
      telegramConfigured: !!row?.enabled,
      username: row?.bot_username || "",
      linked: !!row?.chat_id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const account = await user();
  if (!account)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    if (!encryptionReady())
      throw new Error(
        "Integration encryption is not configured on the server yet.",
      );
    const body = await request.json();
    const database = await db();
    await database.execute({
      sql: "INSERT OR IGNORE INTO integrations (user_id) VALUES (?)",
      args: [account.id],
    });
    const row = (
      await database.execute({
        sql: "SELECT i.*,g.api_key AS groq_key,g.model AS groq_model FROM integrations i LEFT JOIN groq_settings g ON g.user_id=i.user_id WHERE i.user_id=?",
        args: [account.id],
      })
    ).rows[0];
    if (body.action === "groq") {
      const key = typeof body.key === "string" ? body.key.trim() : "";
      const model = typeof body.model === "string" ? body.model.trim() : "";
      if (
        !/^[a-zA-Z0-9/._-]{1,100}$/.test(model) ||
        key.length > 512 ||
        (!key && !row.groq_key)
      )
        throw new Error(
          "Enter your Groq API key and an image-capable Groq model.",
        );
      const token = key || decrypt(String(row.groq_key), account.id);
      const check = await fetch(
        "https://api.groq.com/openai/v1/models",
        {
          headers: { Authorization: "Bearer " + token },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (check.status === 401)
        throw new Error("Could not verify: Groq rejected the API key (401). Copy a fresh API key from console.groq.com/keys, without quotes or a Bearer prefix.");
      if (check.status === 403)
        throw new Error("Could not verify: Groq denied access (403). Check your Groq project permissions and model access.");
      if (check.status === 429)
        throw new Error("Could not verify: Groq is rate-limiting requests (429). Wait a moment and try again.");
      if (!check.ok)
        throw new Error("Could not verify: Groq is temporarily unavailable (HTTP " + check.status + "). Please try again.");
      const available = await check.json();
      if (!Array.isArray(available.data))
        throw new Error("Could not verify: Groq returned an unexpected model list. Please try again.");
      if (!available.data.some((item: {id?:string}) => item.id === model))
        throw new Error("Could not verify: The API key works, but this model is not in Groq's active model list. Check the exact model ID in your Groq console.");
      await database.execute({
        sql: "INSERT INTO groq_settings (api_key,model,user_id) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET api_key=excluded.api_key,model=excluded.model",
        args: [encrypt(token, account.id), model, account.id],
      });
      return Response.json({ ok: true });
    }
    if (body.action === "remove-groq") {
      await database.execute({
        sql: "DELETE FROM groq_settings WHERE user_id=?",
        args: [account.id],
      });
      return Response.json({ ok: true });
    }
    if (body.action === "disconnect") {
      await database.execute({
        sql: "UPDATE integrations SET enabled=0,chat_id=NULL,link_hash=NULL,webhook_hash=NULL WHERE user_id=?",
        args: [account.id],
      });
      let warning = "";
      if (row.bot_token)
        try {
          await telegram(
            decrypt(String(row.bot_token), account.id),
            "deleteWebhook",
          );
        } catch {
          warning =
            "Disconnected in Kopi. Telegram could not remove its webhook; revoke the token in BotFather if you no longer need this bot.";
        }
      await database.execute({
        sql: "UPDATE integrations SET bot_token=NULL,bot_id=NULL,bot_username=NULL WHERE user_id=?",
        args: [account.id],
      });
      return Response.json({ ok: true, warning });
    }
    if (body.action === "link") {
      if (!row.enabled) throw new Error("Connect a Telegram bot first.");
      const code = randomBytes(24).toString("hex");
      await database.execute({
        sql: "UPDATE integrations SET link_hash=?,link_expires=? WHERE user_id=?",
        args: [digest(code), Date.now() + 600000, account.id],
      });
      return Response.json({
        link: "https://t.me/" + row.bot_username + "?start=" + code,
      });
    }
    if (body.action === "telegram") {
      if (row.bot_token)
        throw new Error(
          "Disconnect your current bot before connecting another one.",
        );
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!/^\d+:[a-zA-Z0-9_-]{20,150}$/.test(token))
        throw new Error("Enter a valid BotFather bot token.");
      const origin =
        process.env.KOPI_PUBLIC_URL || "https://book-kepping-app.vercel.app";
      const webhook = origin + "/api/telegram/" + account.id;
      const bot = await telegram(token, "getMe");
      const occupied = await database.execute({
        sql: "SELECT user_id FROM integrations WHERE bot_id=? AND user_id<>?",
        args: [String(bot.id), account.id],
      });
      if (occupied.rows.length)
        throw new Error(
          "This bot is already connected to another Kopi account.",
        );
      const previous = await telegram(token, "getWebhookInfo");
      if (previous.url && previous.url !== webhook)
        throw new Error(
          "This bot already has another webhook. Create a dedicated Kopi bot in BotFather instead.",
        );
      const secret = randomBytes(32).toString("hex");
      await database.execute({
        sql: "UPDATE integrations SET bot_token=?,bot_id=?,bot_username=?,webhook_hash=?,enabled=0,chat_id=NULL,link_hash=NULL WHERE user_id=?",
        args: [
          encrypt(token, account.id),
          String(bot.id),
          String(bot.username),
          digest(secret),
          account.id,
        ],
      });
      await telegram(token, "setWebhook", {
        url: webhook,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        max_connections: 1,
      });
      await database.execute({
        sql: "UPDATE integrations SET enabled=1 WHERE user_id=?",
        args: [account.id],
      });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    // Never return provider bodies, URLs containing tokens, or database errors.
    const message = e instanceof Error ? e.message : "";
    const safe =
      /^(Integration encryption|Enter |Could not verify|Disconnect |Connect |This bot |Telegram could)/.test(
        message,
      );
    return Response.json(
      {
        error: safe
          ? message
          : "Unable to update integration settings. Please try again.",
      },
      { status: 400 },
    );
  }
}
