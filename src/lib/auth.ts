import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    scryptSync(password, salt, 64),
  );
}
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function user() {
  const token = (await cookies()).get("session")?.value;
  if (!token) return null;
  const result = await (
    await db()
  ).execute({
    sql: "SELECT users.id, users.name, users.email FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires > ?",
    args: [digest(token), Date.now()],
  });
  return (
    (result.rows[0] as unknown as {
      id: string;
      name: string;
      email: string;
    }) || null
  );
}
export async function createSession(id: string) {
  const token = randomBytes(32).toString("hex");
  await (
    await db()
  ).execute({
    sql: "INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)",
    args: [digest(token), id, Date.now() + 30 * 86400000],
  });
  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
