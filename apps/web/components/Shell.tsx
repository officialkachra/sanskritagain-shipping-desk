"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  { group: "Operations", items: [{ href: "/", label: "Orders / Dispatch" }, { href: "/manifest", label: "Manifest" }] },
  { group: "After dispatch", items: [{ href: "/tracking", label: "Tracking" }, { href: "/ndr", label: "NDR" }] },
  { group: "Configure", items: [{ href: "/rules", label: "Allocation Rules" }, { href: "/reports", label: "Reports" }, { href: "/settings", label: "Settings" }] },
];

export function Shell({ user, role, mode, logout, children }: { user: string; role: string; mode: string; logout: () => void; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (h: string) => (h === "/" ? path === "/" || path.startsWith("/orders") : path.startsWith(h));
  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <header className="mobilebar">
        <button className="iconbtn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
        <span className="mb-title">Shipping Desk</span>
        <span className={`env env-${mode}`}>{mode}</span>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
        <div className="brandrow">
          <span className="mono" aria-hidden>स</span>
          <span className="brandtxt"><b>Sanskrit Again</b><small>Shipping Desk</small></span>
          <button className="iconbtn collapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(c => !c)}>{collapsed ? "»" : "«"}</button>
        </div>
        <nav>
          {NAV.map(g => (
            <div key={g.group} className="navgroup">
              <div className="navlabel">{g.group}</div>
              {g.items.map(i => <Link key={i.href} href={i.href} className={active(i.href) ? "active" : ""} aria-current={active(i.href) ? "page" : undefined} title={i.label}><span className="dot" aria-hidden />{i.label}</Link>)}
            </div>
          ))}
        </nav>
        <div className="sidefoot">
          <span className={`env env-${mode}`} title="Synthetic data only. No courier or Shopify is contacted.">{mode}</span>
          <div className="who"><b>{user}</b><small>{role === "ADMIN" ? "Admin" : role === "PACKER" ? "Packer" : "Support"}</small></div>
          <form action={logout}><button className="linkbtn">Sign out</button></form>
        </div>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
