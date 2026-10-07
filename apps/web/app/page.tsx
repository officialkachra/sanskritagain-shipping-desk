import Link from "next/link";
import { DEMO_ORDERS } from "@/lib/demo-data";
import { view } from "@/lib/store";
import { requireSession } from "@/lib/auth";
import { inr, ist, svcLabel, statusText } from "@/lib/fmt";

export const dynamic = "force-dynamic";
const stageText = { NEW_CASE: "New", FULFILLMENT: "Packing", AWB_GENERATED: "AWB generated", ON_HOLD: "On hold" } as const;

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string }> }) {
  await requireSession();
  const { q = "", stage = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const rows = DEMO_ORDERS.map(view).filter(v =>
    (!stage || v.stage === stage) &&
    (!needle || [v.order.ref, v.order.customer.pincode, v.booking?.awb ?? "", ...v.order.lines.map(l => l.variantId ?? "")].some(x => x.toLowerCase().includes(needle))));
  const counts = DEMO_ORDERS.map(view).reduce<Record<string, number>>((a, v) => ({ ...a, [v.stage]: (a[v.stage] ?? 0) + 1 }), {});
  return (
    <>
      <h1>Orders</h1>
      <form className="filters" role="search">
        <input name="q" defaultValue={q} placeholder="Order, pincode, AWB or variant" aria-label="Search" autoFocus />
        <select name="stage" defaultValue={stage} aria-label="Stage">
          <option value="">All stages</option>
          {Object.entries(stageText).map(([k, t]) => <option key={k} value={k}>{t} ({counts[k] ?? 0})</option>)}
        </select>
        <button>Filter</button>
      </form>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Order</th><th>Placed (IST)</th><th>Pay</th><th>Ship method</th><th>Pincode</th><th>Stage</th><th>Courier</th><th>Status</th><th className="num">Value</th></tr></thead>
          <tbody>
            {rows.map(v => (
              <tr key={v.order.ref}>
                <td><Link href={`/orders/${v.order.ref}`} className="ref">{v.order.ref}</Link></td>
                <td>{ist(v.order.placedAt)}</td>
                <td><span className={`pay ${v.order.payment}`}>{v.order.payment}</span></td>
                <td>{v.order.rawShippingMethod}{v.order.intent === "UNKNOWN" && <span className="flag"> unmapped</span>}</td>
                <td>{v.order.customer.pincode}</td>
                <td>{stageText[v.stage]}</td>
                <td>{v.booking?.awb ? <code>{v.booking.awb}</code> : v.rec.eligible[0] ? svcLabel[v.rec.eligible[0].serviceId] : "—"}</td>
                <td><span className={`st ${v.booking?.state === "CONFIRMED" ? "BOOKED" : v.rec.status}`}>{v.booking?.state === "CONFIRMED" ? "Booked" : v.booking ? v.booking.state.replace(/_/g, " ").toLowerCase() : statusText[v.rec.status]}</span></td>
                <td className="num">{inr(v.total)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="empty">No orders match. Clear the search or pick another stage.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
