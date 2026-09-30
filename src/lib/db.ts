import { createClient, type Client } from "@libsql/client";
let client: Client;
let ready: Promise<unknown> | undefined;
export async function db() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (!url && process.env.VERCEL)
    throw new Error("Turso database is not configured.");
  client ??= createClient({
    url: url || "file:bookkeeping.db",
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
  });
  ready ??= client
    .batch(
      [
        "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, particular TEXT NOT NULL, subscription TEXT NOT NULL DEFAULT '', type TEXT NOT NULL CHECK(type IN ('credit','debit')), amount INTEGER NOT NULL CHECK(amount > 0), receipt_name TEXT, receipt_type TEXT, receipt BLOB)",
        "CREATE INDEX IF NOT EXISTS entries_user_date ON entries(user_id, date)",
        "CREATE TABLE IF NOT EXISTS budget_spaces (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)), created INTEGER NOT NULL, UNIQUE(user_id,name))",
        "CREATE UNIQUE INDEX IF NOT EXISTS budget_spaces_one_active ON budget_spaces(user_id) WHERE active=1",
        "CREATE TABLE IF NOT EXISTS entry_spaces (entry_id TEXT PRIMARY KEY, space_id TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS entry_spaces_space ON entry_spaces(space_id)",
        "CREATE TABLE IF NOT EXISTS telegram_import_spaces (import_id TEXT PRIMARY KEY, space_id TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS transaction_types (user_id TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE, PRIMARY KEY(user_id, name))",
        "CREATE TABLE IF NOT EXISTS transaction_type_icons (user_id TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE, icon TEXT NOT NULL, PRIMARY KEY(user_id, name))",
        "CREATE TABLE IF NOT EXISTS login_attempts (email TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS recovery_questions (user_id TEXT PRIMARY KEY, question TEXT NOT NULL, answer_hash TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS recovery_attempts (email TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS integrations (user_id TEXT PRIMARY KEY, grok_key TEXT, model TEXT NOT NULL DEFAULT 'grok-4.6', bot_token TEXT, bot_id TEXT UNIQUE, bot_username TEXT, webhook_hash TEXT, enabled INTEGER NOT NULL DEFAULT 0, chat_id TEXT, link_hash TEXT, link_expires INTEGER)",
        "CREATE TABLE IF NOT EXISTS groq_settings (user_id TEXT PRIMARY KEY, api_key TEXT NOT NULL, model TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS telegram_imports (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, bot_id TEXT NOT NULL, message_id INTEGER NOT NULL, status TEXT NOT NULL, updated INTEGER NOT NULL, created INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 1, notified INTEGER NOT NULL DEFAULT 0, draft TEXT, receipt BLOB, receipt_type TEXT, UNIQUE(user_id,bot_id,message_id))",
      ],
      "write",
    )
    .catch((error) => {
      ready = undefined;
      throw error;
    });
  await ready;
  return client;
}
