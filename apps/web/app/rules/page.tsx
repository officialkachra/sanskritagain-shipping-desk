import Link from "next/link";
import { allocate, SEED_RULESET, DEMO_EXPRESS_DRAFT, OPEN_EXPRESS_DECISIONS, BOX_TYPES, type AllocationPolicy, type PaymentMode, type ShippingIntent } from "@shipdesk/core";
import { requireSession } from "@/lib/auth";
import { demoContext } from "@/lib/demo-data";
import { svcLabel, inr, recText } from "@/lib/fmt";

export const dynamic = "force-dynamic";
const stateChip: Record<string, [string, string]> = { ACTIVE: ["Active", "green"], UNVERIFIED_MAPPING: ["Active, mapping unverified", "amber"], DRAFT_EXAMPLE: ["Draft example (demo)", "grey"], RETIRED: ["Retired", "grey"] };
const summary = (p: AllocationPolicy) => `IF ${p.match.direction.toLowerCase()} AND payment is ${p.match.payments.join(" or ")} AND method is ${p.match.intents.join(" or ").toLowerCase()}${p.scope?.destPincodes ? ` AND pincode is ${p.scope.destPincodes.join(", ")}` : ""}`;

export default async function Rules({ searchParams }: { searchParams: Promise<{ p?: string; pay?: string; intent?: string; pin?: string; w?: string; sim?: string }> }) {
  await requireSession();
  const sp = await searchParams;
  const policies = [...SEED_RULESET.policies, DEMO_EXPRESS_DRAFT].sort((a, b) => a.priority - b.priority);
  const sel = policies.find(p => p.id === sp.p) ?? null;
  const sim = sp.sim ? allocate({ orderRef: "SIMULATION", payment: (sp.pay === "COD" ? "COD" : "PREPAID") as PaymentMode, direction: "FORWARD", intent: (["STANDARD", "EXPRESS", "UNKNOWN"].includes(sp.intent ?? "") ? sp.intent : "STANDARD") as ShippingIntent,
    rawShippingMethod: "simulation", destPincode: sp.pin ?? "", codAmountPaise: sp.pay === "COD" ? 49900 : 0, packedWeightG: Number(sp.w) || 500, box: BOX_TYPES[2]!, packingValidated: true }, demoContext(Number(sp.w) || 500)) : null;
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Allocation rules</h1><p className="purpose">Which courier each order goes to, in what order, and why others are skipped.</p></div>
        <div className="headacts"><span className="sync">Rule set {SEED_RULESET.version}. Editing and reordering are not built yet.</span></div></div>
      <div className="stagesexplain">
        <span><b>1. Eligibility</b> payment, direction, weight, serviceability</span><span><b>2. Scoped rules</b> e.g. 560064 → Blue Dart only</span>
        <span><b>3. Blacklist</b> scoped, with reason and expiry</span><span><b>4. Ordered priority</b> P1 first, fallback down the list</span>
        <span><b>5. Ranking</b> RTO80/Pricing20 is a future preference; never overrides 1–4</span>
      </div>
      <div className={sel ? "split" : ""}>
        <div className="rulecards">
          {policies.map(p => { const [t, tone] = stateChip[p.state]!; return (
            <Link key={p.id} href={`?p=${p.id}`} className={`rulecard ${sel?.id === p.id ? "on" : ""}`}>
              <div className="rc-top"><span className="prio">#{p.priority}</span><b>{p.name}</b><span className={`chip ${tone}`}>{t}</span></div>
              <div className="rc-if">{summary(p)}</div>
              <div className="rc-then">THEN {p.orderedServiceIds.map(id => svcLabel[id]).join(" → ")}{p.exclusive ? " (only these, no fallback)" : ""}</div>
            </Link>); })}
          <div className="callout amber"><b>Express policy undecided.</b> Every Express order is flagged “Needs policy decision” and cannot be booked. Open decisions: <ul>{OPEN_EXPRESS_DECISIONS.map(d => <li key={d}>{d}</li>)}</ul></div>
        </div>
        {sel && (
          <aside className="drawer">
            <div className="paneltop"><h2>{sel.name}</h2><Link href="?" className="linkbtn">Close</Link></div>
            <dl className="snap"><dt>Priority</dt><dd>#{sel.priority}</dd><dt>State</dt><dd>{stateChip[sel.state]![0]}</dd><dt>Condition</dt><dd>{summary(sel)}</dd>
              <dt>Services</dt><dd><ol>{sel.orderedServiceIds.map(id => <li key={id}>{svcLabel[id]}</li>)}</ol></dd><dt>Fallback</dt><dd>{sel.exclusive ? "None — only these services" : "Falls down the list; then no other rule"}</dd>
              <dt>Source</dt><dd>{sel.provenance}</dd></dl>
            {sel.history && <><h3>History</h3><ul className="log">{sel.history.map((h, i) => <li key={i}><time>{h.at}</time> {h.note}</li>)}</ul></>}
          </aside>
        )}
      </div>
      <section className="panel">
        <h2>Simulate an order</h2>
        <form className="toolbar">
          <input type="hidden" name="sim" value="1" />
          <label className="lbl">Payment<select name="pay" defaultValue={sp.pay ?? "PREPAID"} className="inp"><option>PREPAID</option><option>COD</option></select></label>
          <label className="lbl">Method<select name="intent" defaultValue={sp.intent ?? "STANDARD"} className="inp"><option>STANDARD</option><option>EXPRESS</option><option>UNKNOWN</option></select></label>
          <label className="lbl">Pincode<input name="pin" defaultValue={sp.pin ?? "560064"} className="inp" inputMode="numeric" /></label>
          <label className="lbl">Weight (g)<input name="w" defaultValue={sp.w ?? "550"} className="inp" inputMode="numeric" /></label>
          <button className="btn btn-primary">Run simulation</button>
        </form>
        {sim && (<>
          <p><span className={`chip ${recText[sim.status]![1]}`}>{recText[sim.status]![0]}</span> <span className="muted">policy {sim.policyId ?? "none"} · synthetic serviceability and rates</span></p>
          {sim.reviewReasons.length > 0 && <ul className="reasons">{sim.reviewReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          <ol className="ladder">{[...sim.eligible.map(e => ({ id: e.serviceId, p: e.priority, txt: e.quoteState === "VALID" ? inr(e.quote!.amountPaise) : `quote ${e.quoteState.toLowerCase()}`, ok: true })), ...sim.excluded.map(x => ({ id: x.serviceId, p: x.priority, txt: x.reasons.join("; "), ok: false }))].sort((a, b) => a.p - b.p)
            .map(r => <li key={r.id} className={r.ok ? "ok" : "out"}><span className="p">P{r.p}</span><span className="name">{svcLabel[r.id]}</span><span className={r.ok ? "q" : "why"}>{r.txt}</span></li>)}</ol>
          <details className="trace"><summary>Raw decision trace</summary><ol>{sim.trace.map((t, i) => <li key={i}><code>{t}</code></li>)}</ol></details>
        </>)}
      </section>
    </div>
  );
}
