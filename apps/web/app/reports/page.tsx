import Link from "next/link";
import { cohortReport, type ShipmentOutcome, type Outcome } from "@shipdesk/core";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
function synthetic(): ShipmentOutcome[] {
  const spec: [string, Partial<Record<Outcome, number>>, number][] = [
    ["Courier A (synthetic)", { DELIVERED: 420, COMPLETED_RTO: 30, PENDING_RTO: 4, OPEN: 40, CANCELLED: 2 }, 70],
    ["Courier B (synthetic)", { DELIVERED: 160, COMPLETED_RTO: 28, PENDING_RTO: 6, OPEN: 30 }, 90],
    ["Courier C (synthetic)", { OPEN: 60, PENDING_RTO: 2 }, 110],
  ];
  const rows: ShipmentOutcome[] = [];
  for (const [cohort, counts, baseH] of spec) for (const [outcome, n] of Object.entries(counts) as [Outcome, number][]) for (let i = 0; i < n; i++) {
    const p = new Date(Date.UTC(2026, 8, 1) + i * 36e5); rows.push({ cohort, outcome, pickedUpAt: p, deliveredAt: outcome === "DELIVERED" ? new Date(p.getTime() + (baseH + ((i * 37) % 60)) * 36e5) : null });
  }
  return rows;
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSession();
  const { tab = "imported" } = await searchParams;
  const rep = cohortReport(synthetic(), 200);
  const pct = (x: number | null) => (x === null ? "N/A" : `${(x * 100).toFixed(1)}%`);
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Reports</h1><p className="purpose">Courier outcomes by account and cohort. Real and synthetic data are kept apart.</p></div></div>
      <nav className="tabs"><Link href="?tab=imported" className={tab === "imported" ? "on" : ""}>Imported history</Link><Link href="?tab=synthetic" className={tab === "synthetic" ? "on" : ""}>Synthetic demo</Link></nav>
      {tab === "imported" ? (
        <section className="panel">
          <h2>No historical shipments imported</h2>
          <p className="muted">The importer is built and tested, but no original ClickPost or QuickShip CSV has been supplied, and this public demo must not hold real customer data. Imports run locally (or on the private production database once Postgres is set up).</p>
          <ol className="steps-list">
            <li>Keep the original exports outside the repository.</li>
            <li>Run <code>npm run import:csv -- --profile clickpost --file /path/to/export.csv</code> locally.</li>
            <li>Check the reconciliation: unique AWBs, each outcome, unknown statuses, duplicates and conflicts.</li>
            <li>Expected if the files match: ClickPost 6,334 AWBs (5,397 delivered, 601 RTO done, 33 RTO pending, 289 open, 13 cancelled, 1 lost); QuickShip 388 AWBs (91 delivered, 0 RTO done, 2 RTO pending, 296 unfinished, 1 cancelled).</li>
          </ol>
          <p className="muted">QuickShip’s clock time zone is unlabelled, so it is kept as unknown. Its cohort is too young to judge RTO.</p>
        </section>
      ) : (
        <section className="panel">
          <p className="callout amber">Synthetic numbers for layout only. Not SanskritAgain results.</p>
          <div className="tablewrap"><table className="grid">
            <thead><tr><th>Courier</th><th className="num">Shipments</th><th className="num">Delivered</th><th className="num">RTO done</th><th className="num">RTO pending</th><th className="num">Open</th><th className="num">Closed RTO</th><th className="num">Delivered timing (median / p90 h)</th><th>Sample</th></tr></thead>
            <tbody>{rep.map(r => <tr key={r.cohort}><td>{r.cohort}</td><td className="num">{r.total}</td><td className="num">{r.counts.DELIVERED}</td><td className="num">{r.counts.COMPLETED_RTO}</td><td className="num">{r.counts.PENDING_RTO}</td><td className="num">{r.counts.OPEN}</td>
              <td className="num">{pct(r.closedRto)} <span className="sub">{r.counts.COMPLETED_RTO}/{r.counts.DELIVERED + r.counts.COMPLETED_RTO}</span></td>
              <td className="num">{r.tatMedianH?.toFixed(0) ?? "—"} / {r.tatP90H?.toFixed(0) ?? "—"} <span className="sub">n={r.tatSample}</span></td>
              <td>{r.mature ? "Enough closed shipments" : <span className="chip amber">Too few closed</span>}</td></tr>)}</tbody></table></div>
          <p className="muted">Closed RTO = RTO done ÷ (delivered + RTO done); with zero closed it is N/A, not 0%. Open and pending are not successes. Timing clock: pickup → delivered. Differences are observational, not proof one courier is better.</p>
        </section>
      )}
    </div>
  );
}
