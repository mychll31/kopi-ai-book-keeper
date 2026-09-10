import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const n = size === "192" ? 192 : 512;
  const portrait = await readFile(join(process.cwd(), "public/images/kopi-logo.png"));
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#203e35",
        color: "#d5efad",
        width: "100%",
        height: "100%",
        fontSize: n * 0.55,
        fontWeight: 700,
      }}
    >
      <img src={`data:image/png;base64,${portrait.toString("base64")}`} alt="Kopi" width={n} height={n} style={{objectFit:"cover"}} />
    </div>,
    { width: n, height: n },
  );
}
