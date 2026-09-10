import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { digest } from "@/lib/auth";
import { decrypt } from "@/lib/integration-secrets";
import { telegram, imageBytes } from "@/lib/telegram";
import { readReceipt, type ReceiptDraft } from "@/lib/receipt-reader";
import { DEFAULT_TYPES } from "@/lib/transaction-types";
import { importSpace } from "@/lib/budget-spaces";
export const maxDuration = 120;
const ok = () => Response.json({ ok: true });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ owner: string }> },
) {
  const { owner } = await params;
  const database = await db();
  const settings = (
    await database.execute({
      sql: "SELECT i.*,g.api_key AS groq_key,g.model AS groq_model FROM integrations i LEFT JOIN groq_settings g ON g.user_id=i.user_id WHERE i.user_id=?",
      args: [owner],
    })
  ).rows[0];
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (!settings?.enabled || !header || digest(header) !== settings.webhook_hash)
    return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 100000)
    return new Response(null, { status: 413 });
  let update;
  try {
    const raw = await request.text();
    if (raw.length > 100000) return new Response(null, { status: 413 });
    update = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const token = decrypt(String(settings.bot_token), owner);
  const message = update.message;
  const callback = update.callback_query;
  const chat = message?.chat || callback?.message?.chat;
  const sender = message?.from || callback?.from;
  if (
    chat?.type !== "private" ||
    sender?.is_bot ||
    String(chat.id) !== String(sender?.id)
  )
    return ok();
  const chatId = String(chat.id);
  const say = (text: string, extra: object = {}) =>
    telegram(token, "sendMessage", { chat_id: chatId, text, ...extra });
  async function notifyJob(id: string) {
    const row = (
      await database.execute({
        sql: "SELECT status,draft,notified FROM telegram_imports WHERE id=? AND user_id=?",
        args: [id, owner],
      })
    ).rows[0];
    if (!row || row.notified) return;
    const space = (
      await database.execute({
        sql: "SELECT b.name FROM telegram_import_spaces s JOIN budget_spaces b ON b.id=s.space_id WHERE s.import_id=? AND b.user_id=?",
        args: [id, owner],
      })
    ).rows[0];
    if (row.status === "pending") {
      const d = JSON.parse(String(row.draft)) as ReceiptDraft;
      await say(
        `PHP ${(d.amount / 100).toFixed(2)} · ${d.date}\n${d.particular}\nBudget Space: ${space?.name || "active space at confirmation"}\nDid you receive or spend this money? Confirm within 24 hours.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Credit · received", callback_data: "credit:" + id },
                { text: "Debit · spent", callback_data: "debit:" + id },
              ],
              [{ text: "Cancel", callback_data: "cancel:" + id }],
            ],
          },
        },
      );
    } else if (row.status === "saved") {
      const e = (
        await database.execute({
          sql: "SELECT type,amount,particular,date FROM entries WHERE id=? AND user_id=?",
          args: [id, owner],
        })
      ).rows[0];
      if (e)
        await say(
          `Saved ${e.type}: PHP ${(Number(e.amount) / 100).toFixed(2)}\n${e.particular}\n${e.date}\nBudget Space: ${space?.name || "Personal"}\nReview or edit in Kopi → Transactions.`,
        );
    } else if (row.status === "failed" && row.draft) {
      await say(JSON.parse(String(row.draft)).error);
    } else return;
    await database.execute({
      sql: "UPDATE telegram_imports SET notified=1 WHERE id=?",
      args: [id],
    });
  }
  if (message?.text?.startsWith("/start ")) {
    const code = message.text.slice(7).trim();
    const linked = await database.execute({
      sql: "UPDATE integrations SET chat_id=?,link_hash=NULL,link_expires=NULL WHERE user_id=? AND link_hash=? AND link_expires>? AND enabled=1",
      args: [chatId, owner, digest(code), Date.now()],
    });
    await say(
      linked.rowsAffected
        ? "Connected to Kopi. Send a clear PHP receipt photo (up to 2 MB). Groq will read it and save credit or debit. Unclear direction needs your confirmation."
        : "That link expired or was already used. Generate a new link in Kopi → Profile → Telegram.",
    );
    return ok();
  }
  if (String(settings.chat_id) !== chatId) return ok();
  if (callback) {
    const match = /^(credit|debit|cancel):([a-f0-9-]{36})$/.exec(
      callback.data || "",
    );
    if (!match) return ok();
    const [, action, id] = match;
    const job = (
      await database.execute({
        sql: "SELECT * FROM telegram_imports WHERE id=? AND user_id=? AND bot_id=?",
        args: [id, owner, String(settings.bot_id)],
      })
    ).rows[0];
    if (
      job?.status === "pending" &&
      Number(job.created) > Date.now() - 86400000
    ) {
      if (action === "cancel")
        await database.execute({
          sql: "UPDATE telegram_imports SET status='cancelled',receipt=NULL,draft=NULL WHERE id=? AND status='pending'",
          args: [id],
        });
      else {
        const draft = JSON.parse(String(job.draft)) as ReceiptDraft;
        const tx = await database.transaction("write");
        try {
          const space = await importSpace(tx, owner, id);
          await tx.batch([
            {
              sql: "INSERT OR IGNORE INTO entries (id,user_id,date,particular,subscription,type,amount,receipt_name,receipt_type,receipt) SELECT id,user_id,?,?,?,?,?,'telegram-receipt',receipt_type,receipt FROM telegram_imports WHERE id=? AND status='pending'",
              args: [
                draft.date,
                draft.particular,
                draft.subscription,
                action,
                draft.amount,
                id,
              ],
            },
            {
              sql: "INSERT OR IGNORE INTO entry_spaces (entry_id,space_id) SELECT id,? FROM entries WHERE id=? AND user_id=?",
              args: [space.id, id, owner],
            },
            {
              sql: "UPDATE telegram_imports SET status='saved',receipt=NULL,draft=NULL WHERE id=? AND status='pending'",
              args: [id],
            },
          ]);
          await tx.commit();
        } catch (e) {
          await tx.rollback();
          if (
            e instanceof Error &&
            e.message.startsWith("Activate a Budget Space")
          ) {
            await say(e.message);
            return ok();
          }
          throw e;
        } finally {
          tx.close();
        }
      }
      await say(
        action === "cancel"
          ? "Cancelled. Nothing added to Kopi."
          : "Saved to Kopi as " + action + ". You can edit it in Transactions.",
      );
    }
    await telegram(token, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: job?.status === "pending" ? "Done" : "Already handled or expired.",
    });
    return ok();
  }
  const file = message?.photo?.at(-1) || message?.document;
  if (!file) {
    await say(
      "Send a JPG, PNG, or WebP receipt image, up to 2 MB. Include a caption such as ‘I received this payment’ when direction is not obvious.",
    );
    return ok();
  }
  if (
    !Number.isSafeInteger(message.message_id) ||
    typeof file.file_id !== "string"
  )
    return ok();
  if (!settings.groq_key) {
    await say(
      "Add your Groq API key in Kopi → Profile → Groq before sending receipts.",
    );
    return ok();
  }
  if (Number(file.file_size) > 2 * 1024 * 1024) {
    await say("This image is too large. Send a compressed photo up to 2 MB.");
    return ok();
  }
  const now = Date.now();
  await database.execute({
    sql: "UPDATE telegram_imports SET receipt=NULL,draft=NULL,status='expired' WHERE user_id=? AND status='pending' AND created<?",
    args: [owner, now - 86400000],
  });
  let job = (
    await database.execute({
      sql: "SELECT * FROM telegram_imports WHERE user_id=? AND bot_id=? AND message_id=?",
      args: [owner, String(settings.bot_id), message.message_id],
    })
  ).rows[0];
  if (job && job.status !== "processing") {
    try {
      await notifyJob(String(job.id));
      return ok();
    } catch {
      return new Response(null, { status: 503 });
    }
  }
  if (job && Number(job.updated) > now - 150000)
    return new Response(null, { status: 503 });
  if (job && Number(job.attempts) >= 3) {
    await database.execute({
      sql: "UPDATE telegram_imports SET status='failed' WHERE id=?",
      args: [String(job.id)],
    });
    await say(
      "Receipt processing timed out. No new transaction was saved. Please resend the image.",
    );
    return ok();
  }
  const id = job ? String(job.id) : randomUUID();
  if (job) {
    const claim = await database.execute({
      sql: "UPDATE telegram_imports SET updated=?,attempts=attempts+1 WHERE id=? AND updated=? AND status='processing'",
      args: [now, id, Number(job.updated)],
    });
    if (!claim.rowsAffected) return new Response(null, { status: 503 });
  } else {
    const count = (
      await database.execute({
        sql: "SELECT COUNT(*) AS n FROM telegram_imports WHERE user_id=? AND created>?",
        args: [owner, now - 3600000],
      })
    ).rows[0];
    if (Number(count.n) >= 20) {
      await say("Hourly limit reached (20 receipts). Try again later.");
      return ok();
    }
    const claim = await database.execute({
      sql: "INSERT OR IGNORE INTO telegram_imports (id,user_id,bot_id,message_id,status,updated,created) VALUES (?,?,?,?,'processing',?,?)",
      args: [id, owner, String(settings.bot_id), message.message_id, now, now],
    });
    if (!claim.rowsAffected) return new Response(null, { status: 503 });
  }
  try {
    const tx = await database.transaction("write");
    let space: { id: string; name: string };
    try {
      space = await importSpace(tx, owner, id);
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.close();
    }
    const info = await telegram(token, "getFile", { file_id: file.file_id });
    if (
      typeof info.file_path !== "string" ||
      !/^[a-zA-Z0-9_./-]+$/.test(info.file_path) ||
      info.file_path.includes("..")
    )
      throw new Error("Image download failed.");
    const { bytes, mime } = await imageBytes(
      await fetch(
        `https://api.telegram.org/file/bot${token}/${info.file_path}`,
        { signal: AbortSignal.timeout(10000) },
      ),
    );
    const labels = (
      await database.execute({
        sql: "SELECT name FROM transaction_types WHERE user_id=? UNION SELECT subscription AS name FROM entries WHERE user_id=? AND subscription<>''",
        args: [owner, owner],
      })
    ).rows.map((r) => String(r.name));
    const types = [...new Set([...DEFAULT_TYPES, ...labels])].slice(0, 150);
    const draft = await readReceipt(
      decrypt(String(settings.groq_key), owner),
      String(settings.groq_model),
      bytes,
      mime,
      types,
      message.caption || "",
    );
    // Recheck authorization after the external AI request in case the user disconnected.
    const current = (
      await database.execute({
        sql: "SELECT i.enabled,i.chat_id,g.api_key AS groq_key,i.bot_id FROM integrations i LEFT JOIN groq_settings g ON g.user_id=i.user_id WHERE i.user_id=?",
        args: [owner],
      })
    ).rows[0];
    if (
      !current?.enabled ||
      String(current.chat_id) !== chatId ||
      current.bot_id !== settings.bot_id ||
      !current.groq_key
    )
      throw new Error("Connection changed. No transaction was saved.");
    if (draft.confident) {
      await database.batch(
        [
          {
            sql: "INSERT OR IGNORE INTO entries (id,user_id,date,particular,subscription,type,amount,receipt_name,receipt_type,receipt) VALUES (?,?,?,?,?,?,?,?,?,?)",
            args: [
              id,
              owner,
              draft.date,
              draft.particular,
              draft.subscription,
              draft.type!,
              draft.amount,
              "telegram-receipt",
              mime,
              bytes,
            ],
          },
          {
            sql: "INSERT OR IGNORE INTO entry_spaces (entry_id,space_id) VALUES (?,?)",
            args: [id, space.id],
          },
          {
            sql: "UPDATE telegram_imports SET status='saved' WHERE id=?",
            args: [id],
          },
        ],
        "write",
      );
      await notifyJob(id);
    } else {
      await database.execute({
        sql: "UPDATE telegram_imports SET status='pending',draft=?,receipt=?,receipt_type=? WHERE id=?",
        args: [JSON.stringify(draft), bytes, mime, id],
      });
      await notifyJob(id);
    }
  } catch (e) {
    const state = (
      await database.execute({
        sql: "SELECT status FROM telegram_imports WHERE id=?",
        args: [id],
      })
    ).rows[0];
    // If the transaction or draft was already committed, never insert it again.
    if (state.status === "processing") {
      const msg = e instanceof Error ? e.message : "";
      const error =
        /^(Activate a Budget Space|Use a clear|The receipt|Groq |Send a |Connection changed)/.test(
          msg,
        )
          ? msg
          : "Unable to read this receipt. Nothing was saved. Please resend or add it manually in Kopi.";
      await database.execute({
        sql: "UPDATE telegram_imports SET status='failed',draft=? WHERE id=?",
        args: [JSON.stringify({ error }), id],
      });
      try {
        await notifyJob(id);
      } catch {
        return new Response(null, { status: 503 });
      }
    } else return new Response(null, { status: 503 });
  }
  return ok();
}
