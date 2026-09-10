import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { user, sameOrigin } from "@/lib/auth";
import { ensureSpaces, listSpaces } from "@/lib/budget-spaces";
export async function GET() {
  const account = await user();
  if (!account)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  return Response.json(
    { spaces: await listSpaces(account.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const account = await user();
  if (!account)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!["create", "activate", "deactivate", "rename"].includes(body.action))
    return Response.json({ error: "Choose a valid action." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (["create", "rename"].includes(body.action) && (!name || name.length > 80))
    return Response.json(
      { error: "Enter a space name of 1–80 characters." },
      { status: 400 },
    );
  const tx = await (await db()).transaction("write");
  try {
    await ensureSpaces(tx, account.id);
    const id = body.action === "create" ? randomUUID() : String(body.id || "");
    if (
      body.action !== "create" &&
      !(
        await tx.execute({
          sql: "SELECT id FROM budget_spaces WHERE id=? AND user_id=?",
          args: [id, account.id],
        })
      ).rows.length
    ) {
      await tx.rollback();
      return Response.json(
        { error: "Budget Space not found." },
        { status: 404 },
      );
    }
    if (
      ["create", "rename"].includes(body.action) &&
      (
        await tx.execute({
          sql: "SELECT id FROM budget_spaces WHERE name=? AND user_id=? AND id<>?",
          args: [name, account.id, id],
        })
      ).rows.length
    ) {
      await tx.rollback();
      return Response.json(
        { error: "A space with this name already exists." },
        { status: 409 },
      );
    }
    if (["create", "activate"].includes(body.action))
      await tx.execute({
        sql: "UPDATE budget_spaces SET active=0 WHERE user_id=?",
        args: [account.id],
      });
    if (body.action === "create")
      await tx.execute({
        sql: "INSERT INTO budget_spaces (id,user_id,name,active,created) VALUES (?,?,?,1,?)",
        args: [id, account.id, name, Date.now()],
      });
    else if (body.action === "rename")
      await tx.execute({
        sql: "UPDATE budget_spaces SET name=? WHERE id=? AND user_id=?",
        args: [name, id, account.id],
      });
    else
      await tx.execute({
        sql: "UPDATE budget_spaces SET active=? WHERE id=? AND user_id=?",
        args: [body.action === "activate" ? 1 : 0, id, account.id],
      });
    await tx.commit();
    return Response.json({ ok: true, id });
  } catch {
    await tx.rollback();
    return Response.json(
      { error: "Unable to update Budget Spaces. Try again." },
      { status: 503 },
    );
  } finally {
    tx.close();
  }
}
