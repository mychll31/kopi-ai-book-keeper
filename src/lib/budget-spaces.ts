import type { Transaction } from "@libsql/client";
import { db } from "./db";
export type BudgetSpace = { id: string; name: string; active: number };
// Called inside a write transaction: migration and active-space selection are serialized.
export async function ensureSpaces(tx: Transaction, owner: string) {
  const id = "personal:" + owner;
  await tx.execute({
    sql: "INSERT OR IGNORE INTO budget_spaces (id,user_id,name,active,created) SELECT ?,?,'Personal',1,? WHERE NOT EXISTS (SELECT 1 FROM budget_spaces WHERE user_id=?)",
    args: [id, owner, Date.now(), owner],
  });
  await tx.execute({
    sql: "INSERT OR IGNORE INTO entry_spaces (entry_id,space_id) SELECT id,? FROM entries WHERE user_id=?",
    args: [id, owner],
  });
}
export async function listSpaces(owner: string) {
  const tx = await (await db()).transaction("write");
  try {
    await ensureSpaces(tx, owner);
    const rows = await tx.execute({
      sql: "SELECT id,name,active FROM budget_spaces WHERE user_id=? ORDER BY created,id",
      args: [owner],
    });
    await tx.commit();
    return rows.rows as unknown as BudgetSpace[];
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
export async function activeSpace(tx: Transaction, owner: string) {
  await ensureSpaces(tx, owner);
  const row = (
    await tx.execute({
      sql: "SELECT id,name FROM budget_spaces WHERE user_id=? AND active=1",
      args: [owner],
    })
  ).rows[0];
  if (!row)
    throw new Error("Activate a Budget Space before adding a transaction.");
  return { id: String(row.id), name: String(row.name) };
}
export async function importSpace(
  tx: Transaction,
  owner: string,
  importId: string,
) {
  const existing = (
    await tx.execute({
      sql: "SELECT b.id,b.name FROM telegram_import_spaces s JOIN budget_spaces b ON b.id=s.space_id WHERE s.import_id=? AND b.user_id=?",
      args: [importId, owner],
    })
  ).rows[0];
  if (existing) return { id: String(existing.id), name: String(existing.name) };
  const space = await activeSpace(tx, owner);
  await tx.execute({
    sql: "INSERT INTO telegram_import_spaces (import_id,space_id) VALUES (?,?)",
    args: [importId, space.id],
  });
  return space;
}
