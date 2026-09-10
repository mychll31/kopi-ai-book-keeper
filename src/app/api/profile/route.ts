import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, sameOrigin } from "@/lib/auth";
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const account = await user();
    if (!account)
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80)
      return NextResponse.json(
        { error: "Enter a name of 1–80 characters." },
        { status: 400 },
      );
    await (
      await db()
    ).execute({
      sql: "UPDATE users SET name=? WHERE id=?",
      args: [name, account.id],
    });
    return NextResponse.json({ user: { ...account, name } });
  } catch {
    return NextResponse.json(
      { error: "Unable to update your profile." },
      { status: 503 },
    );
  }
}
