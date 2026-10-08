"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { bulkAction } from "@/app/actions";
import { COLUMNS } from "@/lib/columns";

export interface Row {
  ref: string; awb: string | null; payment: string; customer: string; pincode: string; city: string; carrier: string; placed: string; value: string;
  tags: string[]; rec: string; recTone: string; ready: string; readyTone: string; stage: string; ship: string;
}

export function DispatchTable({ rows, cols, canBulkHold }: { rows: Row[]; cols: string[]; canBulkHold: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [state, act, pending] = useActionState(bulkAction, undefined);
  const toggle = (r: string) => setSel(s => { const n = new Set(s); n.has(r) ? n.delete(r) : n.add(r); return n; });
  const all = rows.length > 0 && rows.every(r => sel.has(r.ref));
  const show = (k: string) => cols.includes(k);
  return (
    <form action={act}>
      {[...sel].map(r => <input key={r} type="hidden" name="refs" value={r} />)}
      {sel.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Bulk actions">
          <b>{sel.size} selected</b><span className="muted">Actions apply only to these orders.</span>
          <button className="btn btn-secondary" name="op" value="rerun" disabled={pending}>Rerun recommendation</button>
          {canBulkHold && <><input name="reason" placeholder="Hold reason" aria-label="Hold reason" className="inp sm" /><button className="btn btn-secondary" name="op" value="hold" disabled={pending}>Hold selected</button></>}
          <button type="button" className="linkbtn" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      {state && (
        <div className={`resultbox ${state.ok ? "ok" : "bad"}`} role="status">
          <b>{state.message}</b>
          {state.results && <ul>{state.results.map(r => <li key={r.ref} className={r.ok ? "ok" : "bad"}>{r.ref}: {r.message}</li>)}</ul>}
        </div>
      )}
      <div className="tablewrap">
        <table className="grid">
          <thead><tr>
            <th className="selcol"><input type="checkbox" aria-label="Select all on this page" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map(r => r.ref)))} /></th>
            <th className="sticky-col">Order No.</th>
            {COLUMNS.filter(([k]) => show(k)).map(([k, l]) => <th key={k} className={k === "value" ? "num" : ""}>{l}</th>)}
            <th className="actcol">Actions</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ref} className={sel.has(r.ref) ? "selected" : ""}>
                <td className="selcol"><input type="checkbox" aria-label={`Select ${r.ref}`} checked={sel.has(r.ref)} onChange={() => toggle(r.ref)} /></td>
                <td className="sticky-col"><Link href={`/orders/${r.ref}`} className="ref">{r.ref}</Link></td>
                {show("awb") && <td>{r.awb ? <code>{r.awb}</code> : <span className="muted">—</span>}</td>}
                {show("payment") && <td><span className={`chip ${r.payment === "COD" ? "amber" : "green"}`}>{r.payment}</span></td>}
                {show("customer") && <td>{r.customer}<div className="sub">{r.city}</div></td>}
                {show("pincode") && <td>{r.pincode}</td>}
                {show("carrier") && <td>{r.carrier}</td>}
                {show("placed") && <td>{r.placed}</td>}
                {show("value") && <td className="num">{r.value}</td>}
                {show("tags") && <td>{r.tags.map(t => <span key={t} className="tag">{t}</span>)}</td>}
                {show("rec") && <td><span className={`chip ${r.recTone}`}>{r.rec}</span></td>}
                {show("ready") && <td><span className={`chip ${r.readyTone}`}>{r.ready}</span></td>}
                {show("stage") && <td>{r.stage}</td>}
                <td className="actcol"><div className="rowacts">
                  <Link href={`/orders/${r.ref}`}>View</Link>
                  <Link href={`/orders/${r.ref}?tab=packing`}>Edit packing</Link>
                  <Link href={`/orders/${r.ref}?tab=booking`}>Review booking</Link>
                </div></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={14} className="empty">No orders in this view. Change the stage tab or clear filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </form>
  );
}
