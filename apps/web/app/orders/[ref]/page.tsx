import Link from "next/link";
import { notFound } from "next/navigation";
import { BOX_TYPES, estimateBillable, DEMO_SERVICES, can } from "@shipdesk/core";
import { getOrder, view, auditLog, STAGES } from "@/lib/store";
import { requireSession } from "@/lib/auth";
import { inr, ist, svcLabel, carrierLabel, recText, trackText } from "@/lib/fmt";
import { ActionForm, ActionButton } from "@/components/ActionForm";
import { approve, book, hold, release, savePacking, rerun, printLabel, scanPacked } from "../../actions";

export const dynamic = "force-dynamic";
const TABS = [["products", "Products"], ["packing", "Packing & stock"], ["allocation", "Allocation trace"], ["booking", "Booking & documents"], ["tracking", "Tracking"], ["ndr", "NDR"], ["activity", "Activity"]] as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ tab?: string }> }) {
  const s = await requireSession();
  const { ref } = await params; const { tab: t } = await searchParams;
  const o = getOrder(ref); if (!o) notFound();
  const v = view(o);
  const tab = TABS.some(([k]) => k === t) ? t! : "packing";
  const locked = ["AWB_GENERATED", "READY_TO_SHIP", "SHIPPED", "CANCELLED"].includes(v.stage);
  const svc = v.rec.eligible[0] ? DEMO_SERVICES.find(x => x.id === v.rec.eligible[0]!.serviceId) : null;
  const est = svc && v.box && v.packing.weightG ? estimateBillable(v.packing.weightG, v.box, svc) : null;
  const history = auditLog().filter(a => a.ref === o.ref);
  const [rt, rtone] = recText[v.rec.status]!;
  const [tt, ttone] = v.trackStatus ? trackText[v.trackStatus]! : ["No tracking", "grey"];

  return (
    <div className="page">
      <div className="identity">
        <Link href={`/?stage=${v.stage}`} className="back">Orders</Link>
        <h1>{o.ref}</h1>
        <span className={`chip ${o.payment === "COD" ? "amber" : "green"}`}>{o.payment}</span>
        <span className="idmeta">{o.customer.city} {o.customer.pincode}</span>
        <span className="idmeta num">{inr(v.total)}</span>
      </div>
      <div className="statusrow">
        <span><small>Dispatch stage</small><b>{STAGES.find(x => x.key === v.stage)!.label}</b></span>
        <span><small>Shopify status</small><b>Synthetic order (no Shopify sync)</b></span>
        <span><small>Courier status</small><b><span className={`chip ${ttone}`}>{tt}</span></b></span>
        <span><small>Environment</small><b><span className="env env-DEMO">DEMO</span></b></span>
        {v.hold && <span><small>Hold</small><b className="warn">{v.hold}</b></span>}
      </div>

      <nav className="tabs sub" aria-label="Order sections">
        {TABS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={k === tab ? "on" : ""} aria-current={k === tab ? "page" : undefined}>{l}{k === "ndr" && v.ndr.length ? <span className="count">{v.ndr.length}</span> : null}</Link>)}
      </nav>

      {tab === "products" && (
        <section className="panel">
          <table className="grid"><thead><tr><th>Item</th><th>Variant ID</th><th className="num">Qty</th><th className="num">Unit price</th></tr></thead>
            <tbody>{o.lines.map((l, i) => <tr key={i}><td>{l.title}</td><td>{l.variantId ? <code>{l.variantId}</code> : <span className="chip red">No variant — booking blocked</span>}</td><td className="num">{l.qty}</td><td className="num">{inr(l.unitPricePaise)}</td></tr>)}</tbody></table>
          <p className="muted">Shipping method from source: <code>{o.rawShippingMethod ?? "none"}</code> → mapped as <b>{o.intent}</b>. Tags: {o.tags.join(", ") || "none"}.</p>
        </section>
      )}

      {tab === "packing" && (
        <section className="panel packpanel">
          <h2>Packing & stock / पैकिंग</h2>
          <ul className="items">{o.lines.map((l, i) => <li key={i}><b>{l.qty}×</b> {l.title}</li>)}</ul>
          <p className="note">
            {v.packing.suggestion.ok
              ? <>Approved demo rule <code>{v.packing.suggestion.ruleId}</code> suggests box <b>{v.packing.suggestion.boxCode.replace("_cm", " cm")}</b>, about {v.packing.suggestion.packageWeightG} g for the whole package. Weigh the actual parcel.</>
              : v.packing.suggestion.reason === "UNKNOWN_SKU" ? "Unknown item: map the variant in Settings before this can ship." : "No approved packing rule for this exact item set. Choose a box and weigh the parcel."}
          </p>
          {locked ? <p className="muted">Packing is locked because the order is {STAGES.find(x => x.key === v.stage)!.label.toLowerCase()}. Changing it would need a new approved shipment.</p> : (
            <ActionForm action={savePacking.bind(null, o.ref)} className="pack" submit="Save packing" variant="primary">
              <label>Box<select name="box" defaultValue={v.packing.boxCode ?? ""} className="inp big">
                <option value="">Choose box</option>{BOX_TYPES.map(b => <option key={b.code} value={b.code}>{b.lengthCm}×{b.breadthCm}×{b.heightCm} cm</option>)}</select></label>
              <label>Actual packed weight (g)<input name="weight" type="number" min={1} step={1} inputMode="numeric" defaultValue={v.packing.weightG ?? ""} placeholder="Weigh with box" className="inp big" /></label>
              <label className="check big"><input type="checkbox" name="stock" defaultChecked={v.packing.stockChecked} /> Stock checked / स्टॉक देखा</label>
            </ActionForm>
          )}
          {est && <p className="muted">Billable weight: {est.billableG ? `${est.billableG} g` : "unknown"}. {est.warnings.join(". ")}.</p>}
          <div className="packacts">
            {!locked && (v.hold
              ? (can(s.role, "order.release") ? <ActionButton action={release.bind(null, o.ref)} label="Release hold" /> : <span className="muted">On hold. Only an admin can release.</span>)
              : <ActionForm action={hold.bind(null, o.ref)} className="inline" submit="Put on hold"><input name="reason" placeholder="Hold reason" aria-label="Hold reason" className="inp" /></ActionForm>)}
            {v.shipment && <ActionButton action={printLabel.bind(null, o.ref)} label={v.printed ? "Reprint existing label" : "Print existing label"} />}
            {v.shipment && <ActionButton action={scanPacked.bind(null, o.ref)} label={v.scanned ? "Parcel scanned ✓" : "Mark parcel scanned"} disabled={v.scanned} />}
          </div>
        </section>
      )}

      {tab === "allocation" && (
        <section className="panel">
          <div className="paneltop"><h2>Allocation trace</h2><ActionButton action={rerun.bind(null, o.ref)} label="Rerun recommendation" /></div>
          <p><span className={`chip ${rtone}`}>{rt}</span> <span className="muted">Rules {v.rec.ruleSetVersion}{v.rec.policyId ? `, policy ${v.rec.policyId}` : ""}. Rerun never books.</span></p>
          {v.recDiff.length > 0 && <div className="callout amber"><b>Changed since stored recommendation:</b><ul>{v.recDiff.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
          {v.stored && !v.recDiff.length && <p className="muted">Matches the stored recommendation from {ist(v.stored.createdAt)}.</p>}
          {v.rec.reviewReasons.length > 0 && <ul className="reasons">{v.rec.reviewReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          <ol className="ladder">
            {[...v.rec.eligible.map(e => ({ ...e, ok: true as const, reasons: [] as string[] })), ...v.rec.excluded.map(x => ({ ...x, ok: false as const, quote: null, quoteState: null }))]
              .sort((a, b) => a.priority - b.priority).map((r, i, arr) => {
                const chosen = r.ok && arr.find(x => x.ok)?.serviceId === r.serviceId;
                return <li key={r.serviceId} className={r.ok ? (chosen ? "chosen" : "ok") : "out"}>
                  <span className="p">P{r.priority}</span><span className="name">{svcLabel[r.serviceId] ?? r.serviceId}</span>
                  {r.ok ? <span className="q">{r.quoteState === "VALID" ? `${inr(r.quote!.amountPaise)} synthetic` : `quote ${r.quoteState?.toLowerCase()}`}</span> : <span className="why">{r.reasons.join("; ")}</span>}
                  {chosen && <span className="tag2">Recommended</span>}
                </li>;
              })}
          </ol>
          {!v.rec.eligible.length && !v.rec.excluded.length && <p className="muted">No courier was ranked: {v.rec.status === "NEEDS_POLICY_REVIEW" ? "the Express policy has not been decided." : "no policy matched."}</p>}
          <details className="trace"><summary>Raw decision trace</summary><ol>{v.rec.trace.map((t, i) => <li key={i}><code>{t}</code></li>)}</ol></details>
        </section>
      )}

      {tab === "booking" && (
        <section className="panel">
          <h2>Booking & documents</h2>
          {v.shipment ? (
            <>
              <p className="done">Booked (synthetic). AWB <code>{v.shipment.awb}</code> with {carrierLabel[v.shipment.carrier]}. Booking again returns this same AWB.</p>
              <dl className="snap"><dt>Booked</dt><dd>{ist(v.shipment.bookedAt)}</dd><dt>Label</dt><dd>{v.printed ? "Printed (synthetic preview)" : "Not printed"}</dd><dt>Scan</dt><dd>{v.scanned ? "Scanned" : "Not scanned"}</dd><dt>Courier manifest</dt><dd>Not supported in demo adapter</dd></dl>
            </>
          ) : v.snap ? (
            <div className="review">
              <h3>Exact shipment to be booked</h3>
              <dl className="snap">
                <dt>Ship to</dt><dd>{v.snap.destination.name}, {v.snap.destination.line1}, {v.snap.destination.city}, {v.snap.destination.state} {v.snap.destination.pincode}</dd>
                <dt>From</dt><dd>Jaipur warehouse (demo)</dd>
                <dt>Items</dt><dd>{o.lines.map(l => `${l.qty}× ${l.title}`).join(", ")}</dd>
                <dt>Payment</dt><dd>{v.snap.payment}{v.snap.payment === "COD" ? `, collect ${inr(v.snap.codAmountPaise)}` : ""}</dd>
                <dt>Package</dt><dd>{v.snap.packedWeightG} g in {v.snap.box.lengthCm}×{v.snap.box.breadthCm}×{v.snap.box.heightCm} cm</dd>
                <dt>Courier</dt><dd>{svcLabel[v.snap.serviceId]}</dd>
                <dt>Quote</dt><dd>{inr(v.snap.quote.amountPaise)} INR, source “{v.snap.quote.source}”, valid till {ist(v.snap.quote.expiresAt)}. Taxes/surcharges unknown. Final courier billing may differ.</dd>
              </dl>
              <p className="muted">{v.approvalCheck.ok ? `Approved by ${v.approval!.approvedBy}. Any change to items, address, warehouse, weight, box, payment, COD amount or courier cancels this approval.` : v.approval ? `Earlier approval is no longer valid: ${v.approvalCheck.reason.replace(/_/g, " ").toLowerCase()}.` : "Not approved yet."}</p>
              {can(s.role, "booking.approve") ? (
                <div className="actions">
                  {!v.approvalCheck.ok && <ActionButton action={approve.bind(null, o.ref)} label="Approve this shipment" variant="primary" />}
                  {v.approvalCheck.ok && (
                    <ActionForm action={book.bind(null, o.ref)} className="inline" submit={v.booking?.state === "UNKNOWN_OUTCOME" ? "Check courier, then book (demo)" : "Book shipment (demo)"} variant="primary">
                      <label>Simulated courier response<select name="behavior" defaultValue="OK" className="inp">
                        <option value="OK">Responds normally</option><option value="TIMEOUT_BUT_BOOKED">Times out, but booked</option><option value="TIMEOUT_NOT_BOOKED">Times out, not booked</option><option value="REJECT">Rejects</option></select></label>
                    </ActionForm>
                  )}
                </div>
              ) : <p className="muted">Only an admin can approve and book. This is enforced on the server.</p>}
            </div>
          ) : <p className="muted">Not bookable yet. See the Allocation trace and Packing tabs for what is missing.</p>}
          {v.booking && v.booking.state !== "CONFIRMED" && <p className="msg bad">Last booking result: {v.booking.state.replace(/_/g, " ").toLowerCase()} ({v.booking.attempts.map(a => a.outcome).join(" → ")})</p>}
        </section>
      )}

      {tab === "tracking" && (
        <section className="panel">
          <h2>Tracking timeline</h2>
          {!v.shipment ? <p className="muted">No shipment yet, so no tracking.</p> : (
            <>
              <p className="muted">Synthetic events. Source time zone Asia/Kolkata. Last successful fetch {ist(v.shipment.lastFetch)}{v.freshness === "STALE" ? " — stale" : ""}. First EDD {v.shipment.firstEdd ?? "unknown"}{v.shipment.revisedEdd ? `, revised ${v.shipment.revisedEdd} (carrier)` : ""}.</p>
              {v.shipment.fetchError && <p className="msg bad">Tracking fetch failed: {v.shipment.fetchError}</p>}
              {v.shipment.events.length ? <ol className="timeline">{[...v.shipment.events].reverse().map((e, i) => <li key={i}><time>{ist(e.occurredAt)}</time><b>{trackText[e.canonical]![0]}</b><span>{e.providerStatus}</span><span className="muted">{e.location}</span></li>)}</ol> : <p className="muted">No scans received yet.</p>}
            </>
          )}
        </section>
      )}

      {tab === "ndr" && (
        <section className="panel">
          <h2>NDR</h2>
          {v.ndr.length ? v.ndr.map(n => <p key={n.id}><Link href={`/ndr?case=${n.id}&tab=${n.status === "RESOLVED" || n.status === "CLOSED" ? "resolved" : "active"}`}>{n.id}</Link> — {n.rawCarrierText} ({n.status.toLowerCase()}, {n.attempts} attempts)</p>) : <p className="muted">No delivery exceptions on this order.</p>}
        </section>
      )}

      {tab === "activity" && (
        <section className="panel">
          <h2>Activity</h2>
          {history.length ? <ul className="log">{history.map((h, i) => <li key={i}><time>{ist(h.at)}</time> {h.actor}: {h.action}</li>)}</ul> : <p className="muted">No actions on this order in this demo session.</p>}
        </section>
      )}
    </div>
  );
}
