import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import {
  createSession,
  digest,
  passwordHash,
  passwordMatches,
  sameOrigin,
  user,
} from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET() {
  try {
    return NextResponse.json({ user: await user() });
  } catch {
    return NextResponse.json(
      { error: "Cannot connect to the database." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 10 ||
      password.length > 128 ||
      (body.mode === "signup" && (!name || name.length > 80))
    )
      return NextResponse.json(
        {
          error:
            "Enter a valid email, name, and a password of 10–128 characters.",
        },
        { status: 400 },
      );
    const database = await db();
    const attempt = await database.execute({
      sql: "INSERT INTO login_attempts (email,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(email) DO UPDATE SET attempts = CASE WHEN reset_at < ? THEN 1 ELSE attempts+1 END, reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END RETURNING attempts",
      args: [
        email,
        Date.now() + 900000,
        Date.now(),
        Date.now(),
        Date.now() + 900000,
      ],
    });
    if (Number(attempt.rows[0].attempts) > 10)
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    const existing = await database.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });
    let id: string;
    if (body.mode === "signup") {
      if (existing.rows.length)
        return NextResponse.json(
          { error: "Unable to create this account. Try signing in." },
          { status: 400 },
        );
      id = randomUUID();
      await database.execute({
        sql: "INSERT INTO users (id,email,name,password) VALUES (?,?,?,?)",
        args: [id, email, name, passwordHash(password)],
      });
    } else {
      const record = existing.rows[0];
      if (!record || !passwordMatches(password, String(record.password)))
        return NextResponse.json(
          { error: "Email or password is incorrect." },
          { status: 401 },
        );
      id = String(record.id);
    }
    await createSession(id);
    return NextResponse.json({ user: await user() });
  } catch {
    return NextResponse.json(
      { error: "Unable to sign in. Please try again." },
      { status: 503 },
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const token = (await cookies()).get("session")?.value;
  if (token)
    await (
      await db()
    ).execute({
      sql: "DELETE FROM sessions WHERE token = ?",
      args: [digest(token)],
    });
  (await cookies()).delete("session");
  return NextResponse.json({ ok: true });
}
