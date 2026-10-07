import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Shipping Desk · SanskritAgain", robots: { index: false, follow: false } };

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
        {s ? (
          <div className="shell">
            <header className="top">
              <Link href="/" className="brand">Shipping Desk</Link>
              <nav>
                <Link href="/">Orders / ऑर्डर</Link>
                <Link href="/rules">Rules &amp; boxes</Link>
                <Link href="/reports">Reports</Link>
              </nav>
              <span className="mode" title="Synthetic data. No courier or Shopify is contacted.">DEMO</span>
              <span className="who">{s.user} · {s.role === "ADMIN" ? "Admin" : "Packer"}</span>
              <form action={logout}><button className="link">Sign out</button></form>
            </header>
            <main>{children}</main>
          </div>
        ) : <main className="bare">{children}</main>}
      </body>
    </html>
  );
}
