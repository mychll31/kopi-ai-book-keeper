import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, sameOrigin } from "@/lib/auth";
import { TYPE_ICONS, defaultIcon } from "@/lib/transaction-types";
export async function GET() {
  try {
    const account = await user();
    if (!account)
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const result = await (
      await db()
    ).execute({
      sql: "SELECT name FROM transaction_types WHERE user_id=? ORDER BY name",
      args: [account.id],
    });
    const icons = await (await db()).execute({sql:"SELECT name,icon FROM transaction_type_icons WHERE user_id=?",args:[account.id]});
    return NextResponse.json({
      icons: Object.fromEntries(icons.rows.map(row => [String(row.name).toLowerCase(), String(row.icon)])),
      types: result.rows.map((row) => String(row.name)),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load transaction types." },
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
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const icon = body.icon ?? defaultIcon(name);
    if (!TYPE_ICONS.includes(icon)) return NextResponse.json({error:"Choose a valid icon."},{status:400});
    if (!name || name.length > 80)
      return NextResponse.json(
        { error: "Enter a type name of 1–80 characters." },
        { status: 400 },
      );
    await (await db()).batch([{
      sql: "INSERT OR IGNORE INTO transaction_types (user_id,name) VALUES (?,?)",
      args: [account.id, name],
    }, {
      sql: "INSERT INTO transaction_type_icons (user_id,name,icon) VALUES (?,?,?) ON CONFLICT(user_id,name) DO UPDATE SET icon=excluded.icon",
      args: [account.id,name,icon],
    }], "write");
    return NextResponse.json({ name, icon });
  } catch {
    return NextResponse.json(
      { error: "Unable to save this type." },
      { status: 503 },
    );
  }
}
