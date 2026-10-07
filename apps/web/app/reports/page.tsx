import { cohortReport, type ShipmentOutcome, type Outcome } from "@shipdesk/core";
import { requireSession } from "@/lib/auth";

// Synthetic outcomes, generated deterministically. These are NOT SanskritAgain's real courier results.
function synthetic(): ShipmentOutcome[] {
  const spec: [string, Partial<Record<Outcome, number>>, number][] = [
    ["Courier A (demo)", { DELIVERED: 420, COMPLETED_RTO: 30, PENDING_RTO: 4, OPEN: 40, CANCELLED: 2 }, 70],
    ["Courier B (demo)", { DELIVERED: 160, COMPLETED_RTO: 28, PENDING_RTO: 6, OPEN: 30 }, 90],
    ["Courier C (demo)", { DELIVERED: 35, COMPLETED_RTO: 9, OPEN: 60, LOST: 1 }, 110],
  ];
  const rows: ShipmentOutcome[] = [];
  for (const [cohort, counts, baseH] of spec)
    for (const [outcome, n] of Object.entries(counts) as [Outcome, number][])
      for (let i = 0; i < n; i++) {
        const p = new Date(Date.UTC(2026, 8, 1) + i * 36e5);
        rows.push({ cohort, outcome, pickedUpAt: p, deliveredAt: outcome === "DELIVERED" ? new Date(p.getTime() + (baseH + ((i * 37) % 60)) * 36e5) : null });
      }
  return rows;
}

export default async function Reports() {
  await requireSession();
  const rep = cohortReport(synthetic(), 200);
  const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
  return (
    <>
      <h1>Courier outcomes</h1>
      <p className="muted">Synthetic demo numbers. Real reports need the original ClickPost CSV exports imported.</p>
      <div className="tablewrap"><table>
        <thead><tr><th>Courier</th><th className="num">Shipments</th><th className="num">Delivered</th><th className="num">RTO done</th><th className="num">RTO pending</th><th className="num">Open</th><th className="num">Closed RTO</th><th className="num">Median / p90 hrs</th><th>Sample</th></tr></thead>
        <tbody>{rep.map(r => (
          <tr key={r.cohort}>
            <td>{r.cohort}</td><td className="num">{r.total}</td><td className="num">{r.counts.DELIVERED}</td><td className="num">{r.counts.COMPLETED_RTO}</td>
            <td className="num">{r.counts.PENDING_RTO}</td><td className="num">{r.counts.OPEN}</td><td className="num">{pct(r.closedRto)}</td>
            <td className="num">{r.tatMedianH?.toFixed(0) ?? "—"} / {r.tatP90H?.toFixed(0) ?? "—"}</td>
            <td>{r.mature ? "enough to compare" : <span className="flag">too few closed shipments</span>}</td>
          </tr>))}
        </tbody>
      </table></div>
      <p className="muted">Closed RTO = completed RTO ÷ (delivered + completed RTO). Open and pending shipments are not counted as successes. A lower rate in mixed samples does not prove one courier is better.</p>
    </>
  );
}
