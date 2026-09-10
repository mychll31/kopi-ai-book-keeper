import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kopi · Simple bookkeeping",
  icons: { icon: "/icon/192", apple: "/icon/192" },
  description:
    "A little clarity for your everyday finances. Track income, expenses, subscriptions, and receipts.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kopi",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#203e35",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
