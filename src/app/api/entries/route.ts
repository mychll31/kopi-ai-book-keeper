import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { user, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cents } from "@/lib/ledger";
import type { InStatement } from "@libsql/client";
import { activeSpace, ensureSpaces, listSpaces } from "@/lib/budget-spaces";
export async function GET(request: Request) {
  try {
    const account = await user();
    if (!account)
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const spaces = await listSpaces(account.id);
    const spaceId = new URL(request.url).searchParams.get("space");
    if (spaceId && !spaces.some((s) => s.id === spaceId))
      return Response.json(
        { error: "Budget Space not found." },
        { status: 404 },
      );
    const result = await (
      await db()
    ).execute({
      sql: "SELECT e.id,e.date,e.particular,e.subscription,e.type,e.amount,e.receipt_name,s.space_id FROM entries e JOIN entry_spaces s ON s.entry_id=e.id WHERE e.user_id = ? AND (? IS NULL OR s.space_id=?) ORDER BY e.date DESC,e.rowid DESC",
      args: [account.id, spaceId, spaceId],
    });
    return NextResponse.json({ entries: result.rows, spaces });
  } catch {
    return NextResponse.json(
      { error: "Unable to load transactions." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const account = await user();
    if (!account)
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const data = await request.formData();
    const id = String(data.get("id") || randomUUID());
    const date = String(data.get("date") || "");
    const particular = String(data.get("particular") || "").trim();
    const subscription = String(data.get("subscription") || "").trim();
    const type = String(data.get("type"));
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      !particular ||
      particular.length > 200 ||
      subscription.length > 80 ||
      !["credit", "debit"].includes(type)
    )
      return NextResponse.json(
        { error: "Check the date, description, and transaction type." },
        { status: 400 },
      );
    let amount: number;
    try {
      amount = cents(String(data.get("amount")));
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 },
      );
    }
    const file = data.get("receipt");
    const receipt = file instanceof File && file.size > 0 ? file : null;
    if (
      receipt &&
      (receipt.size > 2 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          receipt.type,
        ))
    )
      return NextResponse.json(
        { error: "Use a JPG, PNG, WebP, or PDF up to 2 MB." },
        { status: 400 },
      );
    const database = await db();
    const statements: InStatement[] = [];
    if (data.get("id")) {
      const owned = await database.execute({
        sql: "SELECT id FROM entries WHERE id = ? AND user_id = ?",
        args: [id, account.id],
      });
      if (!owned.rows.length) return new Response(null, { status: 404 });
      statements.push({
        sql: "UPDATE entries SET date=?,particular=?,subscription=?,type=?,amount=? WHERE id=? AND user_id=?",
        args: [date, particular, subscription, type, amount, id, account.id],
      });
    } else {
      statements.push({
        sql: "INSERT INTO entries (id,user_id,date,particular,subscription,type,amount) VALUES (?,?,?,?,?,?,?)",
        args: [id, account.id, date, particular, subscription, type, amount],
      });
    }
    if (receipt)
      statements.push({
        sql: "UPDATE entries SET receipt_name=?,receipt_type=?,receipt=? WHERE id=? AND user_id=?",
        args: [
          receipt.name.slice(0, 200),
          receipt.type,
          new Uint8Array(await receipt.arrayBuffer()),
          id,
          account.id,
        ],
      });
    if (data.get("remove_receipt") === "true" && !receipt)
      statements.push({
        sql: "UPDATE entries SET receipt_name=NULL,receipt_type=NULL,receipt=NULL WHERE id=? AND user_id=?",
        args: [id, account.id],
      });
    const tx = await database.transaction("write");
    try {
      if (!data.get("id")) {
        const space = await activeSpace(tx, account.id);
        statements.push({
          sql: "INSERT INTO entry_spaces (entry_id,space_id) VALUES (?,?)",
          args: [id, space.id],
        });
      } else {
        await ensureSpaces(tx, account.id);
        if (data.has("space_id")) {
          const target = String(data.get("space_id") || "");
          const ownedSpace = await tx.execute({
            sql: "SELECT id FROM budget_spaces WHERE id=? AND user_id=?",
            args: [target, account.id],
          });
          if (!ownedSpace.rows.length)
            throw new Error("Budget Space not found.");
          statements.push({
            sql: "UPDATE entry_spaces SET space_id=? WHERE entry_id=?",
            args: [target, id],
          });
        }
      }
      await tx.batch(statements);
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.close();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "Budget Space not found.")
      return Response.json({ error: e.message }, { status: 404 });
    if (e instanceof Error && e.message.startsWith("Activate a Budget Space"))
      return Response.json({ error: e.message }, { status: 409 });
    return NextResponse.json(
      { error: "Unable to save the transaction. Try again." },
      { status: 503 },
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const account = await user();
  if (!account) return new Response(null, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  await (
    await db()
  ).batch(
    [
      {
        sql: "DELETE FROM entry_spaces WHERE entry_id IN (SELECT id FROM entries WHERE id=? AND user_id=?)",
        args: [id, account.id],
      },
      {
        sql: "DELETE FROM entries WHERE id=? AND user_id=?",
        args: [id, account.id],
      },
    ],
    "write",
  );
  return NextResponse.json({ ok: true });
}
