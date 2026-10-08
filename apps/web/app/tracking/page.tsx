import Link from "next/link";
import { allViews } from "@/lib/store";
import { requireSession } from "@/lib/auth";
import { ist, carrierLabel, trackText } from "@/lib/fmt";

export const dynamic = "force-dynamic";
const FILTERS: [string, string, (s: string | null, f: string | null) => boolean][] = [
  ["all", "All", () => true], ["transit", "In transit", s => s === "PICKED_UP" || s === "IN_TRANSIT"], ["ofd", "Out for delivery", s => s === "OUT_FOR_DELIVERY"],
  ["delivered", "Delivered", s => s === "DELIVERED"], ["ndr", "Undelivered / NDR", s => s === "NDR"], ["rto", "RTO initiated", s => s === "RTO_INITIATED" || s === "RTO_IN_TRANSIT"],
  ["rtodone", "RTO complete", s => s === "RTO_DELIVERED"], ["lost", "Lost / cancelled", s => s === "LOST" || s === "CANCELLED"], ["stale", "Stale or failed", (_, f) => f === "STALE" || f === "NEVER_FETCHED"],
];

export default async function Tracking({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireSession();
  const { f = "all" } = await searchParams;
  const all = allViews().filter(v => v.shipment);
  const pick = FILTERS.find(x => x[0] === f) ?? FILTERS[0]!;
  const rows = all.filter(v => pick[2](v.trackStatus, v.freshness));
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Tracking</h1><p className="purpose">Where every booked parcel is, and which ones need attention.</p></div>
        <div className="headacts"><span className="sync">Synthetic timelines. Refresh never books or messages anyone.</span></div></div>
      <nav className="tabs" aria-label="Tracking filters">{FILTERS.map(([k, l, fn]) => <Link key={k} href={`?f=${k}`} className={k === pick[0] ? "on" : ""}>{l} <span className="count">{all.filter(v => fn(v.trackStatus, v.freshness)).length}</span></Link>)}</nav>
      <div className="tablewrap"><table className="grid">
        <thead><tr><th className="sticky-col">Order</th><th>AWB</th><th>Courier / service</th><th>Courier status (original)</th><th>Status</th><th>Last scan</th><th>Location</th><th>Last successful fetch</th><th>Freshness</th><th>Age</th></tr></thead>
        <tbody>
          {rows.map(v => { const sh = v.shipment!; const last = sh.events[sh.events.length - 1]; const [t, tone] = v.trackStatus ? trackText[v.trackStatus]! : ["No scans", "grey"];
            const ageD = Math.floor((Date.now() - sh.bookedAt.getTime()) / 864e5);
            return <tr key={sh.awb}>
              <td className="sticky-col"><Link className="ref" href={`/orders/${v.order.ref}?tab=tracking`}>{v.order.ref}</Link></td><td><code>{sh.awb}</code></td>
              <td>{carrierLabel[sh.carrier]}</td><td>{last?.providerStatus ?? <span className="muted">—</span>}</td><td><span className={`chip ${tone}`}>{t}</span></td>
              <td>{ist(last?.occurredAt)}</td><td>{last?.location ?? "—"}</td><td>{ist(sh.lastFetch)}</td>
              <td>{v.freshness === "STALE" ? <span className="chip red" title={sh.fetchError ?? ""}>Stale</span> : v.freshness === "NEVER_FETCHED" ? <span className="chip grey">Not fetched yet</span> : v.freshness === "TERMINAL" ? <span className="chip grey">Final</span> : <span className="chip green">Fresh</span>}</td>
              <td>{ageD} d</td></tr>; })}
          {rows.length === 0 && <tr><td colSpan={10} className="empty">No shipments match this filter.</td></tr>}
        </tbody></table></div>
      <p className="muted">Polling stops for final statuses. Historical imported AWBs show “imported only” until a direct courier account can track them.</p>
    </div>
  );
}
