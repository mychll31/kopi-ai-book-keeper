import { NextResponse } from "next/server";
import { passwordHash, passwordMatches, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_RECOVERY_QUESTION, normalizedAnswer } from "@/lib/recovery-question";

const validEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const invalidAnswer = "The recovery answer is incorrect or recovery is not available for this account.";

export async function GET(request: Request) {
  try {
    const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() || "";
    if (!validEmail(email))
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const result = await (await db()).execute({
      sql: "SELECT recovery_questions.question FROM users LEFT JOIN recovery_questions ON recovery_questions.user_id=users.id WHERE users.email=?",
      args: [email],
    });
    return NextResponse.json({
      question: String(result.rows[0]?.question || DEFAULT_RECOVERY_QUESTION),
    });
  } catch {
    return NextResponse.json({ error: "Could not load the recovery question." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const answer = normalizedAnswer(String(body.answer || ""));
    const password = String(body.password || "");
    if (!validEmail(email) || !answer || password.length < 10 || password.length > 128)
      return NextResponse.json(
        { error: "Enter your email, recovery answer, and a new password of 10–128 characters." },
        { status: 400 },
      );
    const database = await db();
    const now = Date.now();
    const attempt = await database.execute({
      sql: "INSERT INTO recovery_attempts (email,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END RETURNING attempts",
      args: [email, now + 900000, now, now, now + 900000],
    });
    if (Number(attempt.rows[0].attempts) > 10)
      return NextResponse.json(
        { error: "Too many recovery attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    const result = await database.execute({
      sql: "SELECT users.id,recovery_questions.answer_hash FROM users LEFT JOIN recovery_questions ON recovery_questions.user_id=users.id WHERE users.email=?",
      args: [email],
    });
    const record = result.rows[0];
    const stored = record?.answer_hash
      ? String(record.answer_hash)
      : process.env.ADMIN_RECOVERY_PASSWORD_HASH;
    if (!record || !stored || !passwordMatches(answer, stored))
      return NextResponse.json({ error: invalidAnswer }, { status: 401 });
    await database.batch(
      [
        { sql: "UPDATE users SET password=? WHERE id=?", args: [passwordHash(password), String(record.id)] },
        { sql: "DELETE FROM sessions WHERE user_id=?", args: [String(record.id)] },
      ],
      "write",
    );
    return NextResponse.json({ message: "Password updated. Sign in with your new password." });
  } catch {
    return NextResponse.json({ error: "Could not reset the password. Please try again later." }, { status: 503 });
  }
}
