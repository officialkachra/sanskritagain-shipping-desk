import Link from "next/link";
import { can, type NdrCase } from "@shipdesk/core";
import { ndrCases, ndrGate, getOrder, view } from "@/lib/store";
import { requireSession } from "@/lib/auth";
import { ist, carrierLabel, trackText } from "@/lib/fmt";
import { ActionForm } from "@/components/ActionForm";
import { ndrRemark, ndrAssign, ndrAction, ndrResolve } from "../actions";

export const dynamic = "force-dynamic";
const reasonText: Record<string, string> = { REFUSED: "Refused", CONSIGNEE_UNAVAILABLE: "Consignee unavailable", ADDRESS_ISSUE: "Address issue", CONTACT_ISSUE: "Contact issue", OTHER: "Other / unknown" };
const due = (c: NdrCase) => c.dueAt && new Date(c.dueAt) < new Date();
const TABS: [string, string, (c: NdrCase) => boolean][] = [
  ["active", "Active", c => c.status === "ACTIVE"], ["due", "Due / overdue", c => (c.status === "ACTIVE" || c.status === "ACTION_PENDING") && !!due(c)],
  ["pending", "Action pending", c => c.status === "ACTION_PENDING"], ["resolved", "Resolved / closed", c => c.status === "RESOLVED" || c.status === "CLOSED"],
];

export default async function Ndr({ searchParams }: { searchParams: Promise<{ tab?: string; case?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const all = ndrCases(); const tab = TABS.find(t => t[0] === sp.tab) ?? TABS[0]!;
  const rows = all.filter(tab[2]); const sel = all.find(c => c.id === sp.case) ?? null;
  const v = sel ? view(getOrder(sel.orderRef)!) : null;
  return (
    <div className="page">
      <div className="pagehead"><div><h1>NDR</h1><p className="purpose">Undelivered parcels: who owns each case, what was tried, what happens next.</p></div>
        <div className="headacts"><span className="sync">Synthetic cases. Remarks stay local; nothing is sent automatically.</span></div></div>
      <nav className="tabs">{TABS.map(([k, l, fn]) => <Link key={k} href={`?tab=${k}`} className={k === tab[0] ? "on" : ""}>{l} <span className="count">{all.filter(fn).length}</span></Link>)}</nav>
      <div className={sel ? "split" : ""}>
        <div className="tablewrap"><table className="grid">
          <thead><tr><th className="sticky-col">Order / AWB</th><th>Courier</th><th>Reason</th><th>Last attempt</th><th className="num">Attempts</th><th>Age</th><th>Assignee</th><th>Due</th><th>Latest remark</th></tr></thead>
          <tbody>
            {rows.map(c => <tr key={c.id} className={sel?.id === c.id ? "selected" : ""}>
              <td className="sticky-col"><Link className="ref" href={`?tab=${tab[0]}&case=${c.id}`}>{c.orderRef}</Link><div className="sub"><code>{c.awb}</code></div></td>
              <td>{carrierLabel[c.carrier]}</td><td>{reasonText[c.reason]}<div className="sub">{c.rawCarrierText}</div></td><td>{ist(c.lastAttemptAt)}</td>
              <td className="num">{c.attempts}</td><td>{Math.floor((Date.now() - new Date(c.openedAt).getTime()) / 864e5)} d</td><td>{c.assignee ?? <span className="muted">Unassigned</span>}</td>
              <td>{c.dueAt ? <span className={due(c) ? "chip red" : "chip grey"}>{ist(c.dueAt)}</span> : "—"}</td><td className="wrap">{c.remarks.at(-1)?.text ?? "—"}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={9} className="empty">No cases here.</td></tr>}
          </tbody></table></div>
        {sel && v && (
          <aside className="drawer" aria-label={`Case ${sel.id}`}>
            <div className="paneltop"><h2>{sel.orderRef}</h2><Link href={`?tab=${tab[0]}`} className="linkbtn">Close</Link></div>
            <p><span className="chip amber">{reasonText[sel.reason]}</span> <span className="muted">Carrier text: “{sel.rawCarrierText}”</span></p>
            <p className="muted">Latest tracking: {v.trackStatus ? trackText[v.trackStatus]![0] : "none"} · <Link href={`/orders/${sel.orderRef}?tab=tracking`}>timeline</Link> · {v.order.lines.map(l => `${l.qty}× ${l.title}`).join(", ")} · {v.order.payment}</p>
            <h3>Remarks (local only)</h3>
            <ul className="log">{sel.remarks.map((r, i) => <li key={i}><time>{ist(r.at)}</time> {r.by}: {r.text}</li>)}{!sel.remarks.length && <li className="muted">None yet.</li>}</ul>
            {can(s.role, "ndr.remark") && <ActionForm action={ndrRemark.bind(null, sel.id)} submit="Save remark" className="stack"><textarea name="text" rows={2} className="inp" aria-label="Remark" placeholder="Saved here only. Not sent to customer or courier." /></ActionForm>}
            {can(s.role, "ndr.assign") && <ActionForm action={ndrAssign.bind(null, sel.id)} submit="Assign" className="inline"><select name="who" defaultValue={sel.assignee ?? ""} className="inp" aria-label="Assignee"><option value="">Unassigned</option><option>demo-support</option><option>demo-admin</option></select></ActionForm>}
            <h3>Courier action</h3>
            {(["REATTEMPT", "ADDRESS_UPDATE", "RETURN_REQUEST"] as const).map(kind => { const gate = ndrGate(s, sel, kind); return (
              <details key={kind} className="actbox"><summary>{kind === "REATTEMPT" ? "Request reattempt" : kind === "ADDRESS_UPDATE" ? "Send address / landmark correction" : "Request return"} {!gate.allowed && <span className="chip grey">Unavailable</span>}</summary>
                {gate.allowed ? (
                  <ActionForm action={ndrAction.bind(null, sel.id)} submit="Send (simulated)" variant="primary" className="stack">
                    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="awb" value={sel.awb} />
                    {kind === "ADDRESS_UPDATE" && <label>Landmark<input name="landmark" className="inp" /></label>}
                    {kind === "REATTEMPT" && <label>Preferred date<input type="date" name="date" className="inp" /></label>}
                    <p className="muted">Destination: {carrierLabel[sel.carrier]} demo adapter (simulated). Payload: AWB {sel.awb}{kind === "ADDRESS_UPDATE" ? " + landmark" : kind === "REATTEMPT" ? " + date" : ""}. Tracking rechecked just now: {v.trackStatus ?? "none"}.</p>
                    <label className="check"><input type="checkbox" name="confirm" /> I reviewed this payload and destination</label>
                  </ActionForm>
                ) : <p className="muted">{gate.reason}</p>}
              </details>); })}
            {sel.actions.length > 0 && <ul className="log">{sel.actions.map((a, i) => <li key={i}><time>{ist(a.at)}</time> {a.kind} → <b>{a.outcome.toLowerCase()}</b> ({a.note})</li>)}</ul>}
            {can(s.role, "ndr.carrier_action") && sel.status !== "RESOLVED" && sel.status !== "CLOSED" && <ActionForm action={ndrResolve.bind(null, sel.id)} submit="Close case" className="stack"><input name="evidence" className="inp" placeholder="Evidence, e.g. delivered scan on 12 Oct" aria-label="Evidence" /></ActionForm>}
            <p className="muted">Customer/courier messages are never sent from here. Copy drafts manually if needed.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
