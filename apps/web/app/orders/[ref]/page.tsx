import Link from "next/link";
import { notFound } from "next/navigation";
import { BOX_TYPES, estimateBillable, DEMO_SERVICES } from "@shipdesk/core";
import { getOrder, view, auditLog } from "@/lib/store";
import { requireSession } from "@/lib/auth";
import { inr, ist, svcLabel, statusText } from "@/lib/fmt";
import { approve, book, hold, release, savePacking } from "../../actions";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const s = await requireSession();
  const { ref } = await params;
  const o = getOrder(ref); if (!o) notFound();
  const v = view(o);
  const isAdmin = s.role === "ADMIN";
  const booked = v.booking?.state === "CONFIRMED";
  const svc = v.rec.eligible[0] ? DEMO_SERVICES.find(x => x.id === v.rec.eligible[0]!.serviceId) : null;
  const est = svc && v.box && v.packing.weightG ? estimateBillable(v.packing.weightG, v.box, svc) : null;
  const history = auditLog().filter(a => a.ref === o.ref);

  return (
    <>
      <div className="identity">
        <Link href="/" className="back">Orders</Link>
        <h1>{o.ref}</h1>
        <span className={`pay ${o.payment}`}>{o.payment}</span>
        <span>{o.rawShippingMethod ?? "no shipping method"}</span>
        <span>{o.customer.city} {o.customer.pincode}</span>
        <span className="num">{inr(v.total)}</span>
        {v.hold && <span className="st REVIEW_REQUIRED">On hold: {v.hold}</span>}
      </div>

      <div className="cols">
        <section className="panel">
          <h2>Pack / पैकिंग</h2>
          <ul className="items">
            {o.lines.map((l, i) => <li key={i}><b>{l.qty}×</b> {l.title} {l.variantId ? <code>{l.variantId}</code> : <span className="flag">no variant ID — booking blocked</span>}</li>)}
          </ul>
          <p className="muted">
            {v.packing.suggestion.ok
              ? <>Validated rule <code>{v.packing.suggestion.ruleId}</code> suggests box {v.packing.suggestion.boxCode}, about {v.packing.suggestion.packageWeightG} g whole package (demo rule).</>
              : v.packing.suggestion.reason === "UNKNOWN_SKU" ? "Unknown item. Map the variant before this can ship." : "No validated packing rule for this exact item set. Choose a box and weigh it."}
          </p>
          <form action={savePacking.bind(null, o.ref)} className="pack">
            <label>Box
              <select name="box" defaultValue={v.packing.boxCode ?? ""} disabled={booked}>
                <option value="">Choose box</option>
                {BOX_TYPES.map(b => <option key={b.code} value={b.code}>{b.lengthCm}×{b.breadthCm}×{b.heightCm} cm</option>)}
              </select>
            </label>
            <label>Actual packed weight (g)
              <input name="weight" type="number" min={1} step={1} inputMode="numeric" defaultValue={v.packing.weightG ?? ""} placeholder="weigh with box" disabled={booked} />
            </label>
            <label className="check"><input type="checkbox" name="stock" defaultChecked={v.packing.stockChecked} disabled={booked} /> Stock checked / स्टॉक देखा</label>
            <button disabled={booked}>Save packing</button>
          </form>
          {est && <p className="muted">Billable weight: {est.billableG ? `${est.billableG} g` : "unknown"}. {est.warnings.join(". ")}.</p>}
          {!booked && (v.hold
            ? isAdmin && <form action={release.bind(null, o.ref)}><button>Release hold</button></form>
            : <form action={hold.bind(null, o.ref)} className="inline"><input name="reason" placeholder="Hold reason" aria-label="Hold reason" /><button>Put on hold</button></form>)}
        </section>

        <section className="panel">
          <h2>Courier choice</h2>
          <p><span className={`st ${v.rec.status}`}>{statusText[v.rec.status]}</span> <span className="muted">rules {v.rec.ruleSetVersion}{v.rec.policyId ? `, policy ${v.rec.policyId}` : ""}</span></p>
          {v.rec.reviewReasons.length > 0 && <ul className="reasons">{v.rec.reviewReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          <ol className="ladder">
            {[...v.rec.eligible.map(e => ({ ...e, ok: true as const, reasons: [] as string[] })), ...v.rec.excluded.map(x => ({ ...x, ok: false as const, quote: null, quoteState: null }))]
              .sort((a, b) => a.priority - b.priority)
              .map((r, i, arr) => {
                const chosen = r.ok && arr.find(x => x.ok)?.serviceId === r.serviceId;
                return (
                  <li key={r.serviceId} className={r.ok ? (chosen ? "chosen" : "ok") : "out"}>
                    <span className="p">P{r.priority}</span>
                    <span className="name">{svcLabel[r.serviceId] ?? r.serviceId}</span>
                    {r.ok ? <span className="q">{r.quoteState === "VALID" ? inr(r.quote!.amountPaise) : `quote ${r.quoteState?.toLowerCase()}`}</span>
                          : <span className="why">{r.reasons.join("; ")}</span>}
                    {chosen && <span className="tag">recommended</span>}
                  </li>
                );
              })}
          </ol>
          {v.rec.eligible.length === 0 && v.rec.excluded.length === 0 && <p className="muted">No allocation policy matched this order, so nothing was ranked.</p>}
        </section>
      </div>

      <section className="panel review">
        <h2>Review and book</h2>
        {booked ? (
          <p className="done">Booked. AWB <code>{v.booking!.awb}</code> (simulated, demo). Booking again returns this same AWB; it never creates a second one.</p>
        ) : v.snap ? (
          <>
            <dl className="snap">
              <dt>Ship to</dt><dd>{v.snap.destination.name}, {v.snap.destination.line1}, {v.snap.destination.city}, {v.snap.destination.state} {v.snap.destination.pincode}</dd>
              <dt>From</dt><dd>Jaipur warehouse (demo)</dd>
              <dt>Items</dt><dd>{o.lines.map(l => `${l.qty}× ${l.title}`).join(", ")}</dd>
              <dt>Payment</dt><dd>{v.snap.payment}{v.snap.payment === "COD" ? `, collect ${inr(v.snap.codAmountPaise)}` : ""}</dd>
              <dt>Package</dt><dd>{v.snap.packedWeightG} g in {v.snap.box.lengthCm}×{v.snap.box.breadthCm}×{v.snap.box.heightCm} cm</dd>
              <dt>Courier</dt><dd>{svcLabel[v.snap.serviceId]}, {inr(v.snap.quote.amountPaise)} quote ({v.snap.quote.source}), valid till {ist(v.snap.quote.expiresAt)}</dd>
            </dl>
            <p className="muted">
              {v.approvalCheck.ok ? `Approved by ${v.approval!.approvedBy}. Any change to packing, address, payment or courier cancels this approval.`
                : v.approval ? `Earlier approval no longer valid: ${v.approvalCheck.reason.replace(/_/g, " ").toLowerCase()}.` : "Not approved yet."}
            </p>
            {isAdmin ? (
              <div className="actions">
                {!v.approvalCheck.ok && <form action={approve.bind(null, o.ref)}><button className="primary">Approve this shipment</button></form>}
                {v.approvalCheck.ok && (
                  <form action={book.bind(null, o.ref)} className="inline">
                    <label>Simulate courier
                      <select name="behavior" defaultValue="OK">
                        <option value="OK">responds normally</option>
                        <option value="TIMEOUT_BUT_BOOKED">times out (but booked)</option>
                        <option value="TIMEOUT_NOT_BOOKED">times out (not booked)</option>
                        <option value="REJECT">rejects</option>
                      </select>
                    </label>
                    <button className="primary">{v.booking?.state === "UNKNOWN_OUTCOME" ? "Check courier, then book" : "Book shipment"}</button>
                  </form>
                )}
              </div>
            ) : <p className="muted">Only an admin can approve and book. Packers prepare packing and holds.</p>}
          </>
        ) : <p className="muted">Not bookable yet. Fix the items listed under “Courier choice” first.</p>}
        {v.booking && !booked && <p className="err">Last booking result: {v.booking.state.replace(/_/g, " ").toLowerCase()} ({v.booking.attempts.map(a => a.outcome).join(" → ")})</p>}
      </section>

      <section className="panel">
        <h2>History</h2>
        {history.length ? <ul className="log">{history.map((h, i) => <li key={i}><time>{ist(h.at)}</time> {h.actor}: {h.action}</li>)}</ul> : <p className="muted">No actions yet on this order.</p>}
      </section>
    </>
  );
}
