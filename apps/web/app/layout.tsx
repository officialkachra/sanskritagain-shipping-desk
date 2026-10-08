import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { logout } from "./actions";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Shipping Desk · Sanskrit Again", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Devanagari:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {s ? <Shell user={s.user} role={s.role} mode="DEMO" logout={logout}>{children}</Shell> : <main className="bare">{children}</main>}
      </body>
    </html>
  );
}
