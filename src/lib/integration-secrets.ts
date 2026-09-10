import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptionReady() {
  return /^[a-f0-9]{64}$/i.test(process.env.INTEGRATION_ENCRYPTION_KEY || "");
}
function key() {
  if (!encryptionReady())
    throw new Error("Integration encryption is not configured on the server.");
  return Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY!, "hex");
}
export function encrypt(value: string, owner: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function decrypt(value: string, owner: string) {
  const [iv, tag, data] = value.split(".").map((v) => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
