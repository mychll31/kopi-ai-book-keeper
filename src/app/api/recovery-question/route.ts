import { NextResponse } from "next/server";
import { passwordHash, sameOrigin, user } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_RECOVERY_QUESTION, normalizedAnswer } from "@/lib/recovery-question";

export async function GET() {
  try {
    const account = await user();
    if (!account) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const result = await (await db()).execute({
      sql: "SELECT question FROM recovery_questions WHERE user_id=?",
      args: [account.id],
    });
    return NextResponse.json({
      question: String(result.rows[0]?.question || DEFAULT_RECOVERY_QUESTION),
      configured: result.rows.length > 0,
    });
  } catch {
    return NextResponse.json({ error: "Could not load the recovery question." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const account = await user();
    if (!account) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const body = await request.json();
    const question = String(body.question || "").trim();
    const answer = normalizedAnswer(String(body.answer || ""));
    if (question.length < 10 || question.length > 160 || answer.length < 10 || answer.length > 128)
      return NextResponse.json(
        { error: "Use a question of 10–160 characters and a private answer of 10–128 characters." },
        { status: 400 },
      );
    await (await db()).execute({
      sql: "INSERT INTO recovery_questions (user_id,question,answer_hash) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET question=excluded.question, answer_hash=excluded.answer_hash",
      args: [account.id, question, passwordHash(answer)],
    });
    return NextResponse.json({ question, configured: true });
  } catch {
    return NextResponse.json({ error: "Could not save the recovery question." }, { status: 503 });
  }
}
