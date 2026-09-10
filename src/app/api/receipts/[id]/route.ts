import { user } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const account = await user();
  if (!account) return new Response(null, { status: 401 });
  const { id } = await context.params;
  const result = await (
    await db()
  ).execute({
    sql: "SELECT receipt,receipt_type,receipt_name FROM entries WHERE id=? AND user_id=?",
    args: [id, account.id],
  });
  const row = result.rows[0];
  if (!row?.receipt) return new Response(null, { status: 404 });
  return new Response(row.receipt as ArrayBuffer, {
    headers: {
      "Content-Type": String(row.receipt_type),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(row.receipt_name))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
