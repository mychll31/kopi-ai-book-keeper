import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kopi — Simple bookkeeping",
    short_name: "Kopi",
    description: "Income, expenses, and receipts in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#203e35",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
