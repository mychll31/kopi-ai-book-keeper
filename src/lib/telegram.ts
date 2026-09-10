export async function telegram(
  token: string,
  method: string,
  body: object = {},
) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.ok)
    throw new Error(
      "Telegram could not complete the request. Check your bot token and try again.",
    );
  return data.result;
}
export async function imageBytes(response: Response) {
  if (
    !response.ok ||
    Number(response.headers.get("content-length")) > 2 * 1024 * 1024
  )
    throw new Error("Send a receipt image no larger than 2 MB.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Image download failed.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Send a receipt image no larger than 2 MB.");
    }
    chunks.push(part.value);
  }
  const bytes = Buffer.concat(chunks);
  const mime =
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          ? "image/webp"
          : "";
  if (!mime)
    throw new Error(
      "Send a JPG, PNG, or WebP receipt image. PDFs and other files are not supported by the bot yet.",
    );
  return { bytes, mime };
}
