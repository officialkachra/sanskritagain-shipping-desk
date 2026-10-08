import Link from "next/link";
import { can } from "@shipdesk/core";
import { allViews, STAGES, type OrderView } from "@/lib/store";
import { requireSession } from "@/lib/auth";
import { inr, ist, svcLabel, carrierLabel, recText } from "@/lib/fmt";
import { DispatchTable, type Row } from "@/components/DispatchTable";
import { COLUMNS } from "@/lib/columns";

export const dynamic = "force-dynamic";
const PAGE = 25;
const DEFAULT_COLS = ["awb", "payment", "customer", "pincode", "carrier", "placed", "value", "rec", "ready"];
type SP = { stage?: string; q?: string; bulk?: string; pay?: string; carrier?: string; from?: string; to?: string; page?: string; cols?: string; sort?: string; colpick?: string | string[] };

function ready(v: OrderView): [string, string] {
  if (v.stage === "CANCELLED") return ["—", "grey"];
  if (v.shipment) return [v.printed && v.scanned ? "Label printed, scanned" : "Booked, label pending", v.printed && v.scanned ? "green" : "amber"];
  if (!v.packing.suggestion.ok) return [v.packing.suggestion.reason === "UNKNOWN_SKU" ? "Unknown SKU" : "No packing rule", "red"];
  if (!v.packing.weightG) return ["Not weighed", "grey"];
  return v.packing.stockChecked ? ["Packed, stock ok", "green"] : ["Stock not checked", "amber"];
}

export default async function Dispatch({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireSession();
  const raw = await searchParams;
  const picked = raw.colpick ? ([] as string[]).concat(raw.colpick) : null;
  const { colpick: _c, ...rest } = raw;
  const sp: SP = picked ? { ...rest, cols: picked.join(",") } : rest;
  const stage = STAGES.some(x => x.key === sp.stage) ? sp.stage! : "NEW_CASE";
  const terms = (sp.bulk ?? "").split(/[\s,]+/).map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 200);
  const q = (sp.q ?? "").trim().toLowerCase();
  const cols = sp.cols ? sp.cols.split(",").filter(c => COLUMNS.some(([k]) => k === c)) : DEFAULT_COLS;
  const base = allViews().filter(v => {
    const hay = [v.order.ref, v.order.customer.pincode, v.shipment?.awb ?? "", ...v.order.lines.map(l => l.variantId ?? "")].map(x => x.toLowerCase());
    const placed = v.order.placedAt.slice(0, 10);
    return (!q || hay.some(h => h.includes(q))) && (!terms.length || terms.some(t => hay.includes(t)))
      && (!sp.pay || v.order.payment === sp.pay) && (!sp.carrier || (v.shipment?.carrier ?? v.rec.eligible[0]?.serviceId ?? "").includes(sp.carrier))
      && (!sp.from || placed >= sp.from) && (!sp.to || placed <= sp.to);
  });
  const counts = Object.fromEntries(STAGES.map(st => [st.key, base.filter(v => v.stage === st.key).length]));
  let rows = base.filter(v => v.stage === stage);
  const [sortKey, dir] = (sp.sort ?? "placed:desc").split(":");
  rows = rows.sort((a, b) => { const x = sortKey === "value" ? a.total - b.total : a.order.placedAt.localeCompare(b.order.placedAt); return dir === "asc" ? x : -x; });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)); const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const href = (o: Partial<SP>) => `/?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString()}`;
  const data: Row[] = pageRows.map(v => {
    const [rt, rtone] = v.shipment ? ["Booked", "green"] : recText[v.rec.status]!; const [rd, rdt] = ready(v);
    return { ref: v.order.ref, awb: v.shipment?.awb ?? null, payment: v.order.payment, customer: v.order.customer.name, city: v.order.customer.city, pincode: v.order.customer.pincode,
      carrier: v.shipment ? `${carrierLabel[v.shipment.carrier]}` : v.rec.eligible[0] ? svcLabel[v.rec.eligible[0].serviceId]! : "—", placed: ist(v.order.placedAt), value: inr(v.total),
      tags: v.order.tags, rec: rt, recTone: rtone, ready: rd, readyTone: rdt, stage: STAGES.find(x => x.key === v.stage)!.label, ship: v.order.rawShippingMethod ?? "" };
  });
  const stageInfo = STAGES.find(x => x.key === stage)!;

  return (
    <div className="page">
      <div className="pagehead">
        <div><h1>Orders / Dispatch</h1><p className="purpose">Pack, review and book orders, then hand them to couriers.</p></div>
        <div className="headacts">
          <span className="sync">Shopify sync: not configured (demo orders)</span>
          <Link className="btn btn-secondary" href={href({})}>Refresh</Link>
          <a className="btn btn-secondary" href={`/api/export?${new URLSearchParams({ stage, q: sp.q ?? "" })}`}>Export CSV</a>
        </div>
      </div>

      <nav className="tabs" aria-label="Dispatch stages">
        {STAGES.map(st => <Link key={st.key} href={href({ stage: st.key, page: "" })} className={st.key === stage ? "on" : ""} aria-current={st.key === stage ? "page" : undefined} title={st.hint}>{st.label} <span className="count">{counts[st.key]}</span></Link>)}
      </nav>
      <p className="stagehint">{stageInfo.hint}. {stage === "AWB_GENERATED" ? "An AWB is not a handover; parcels move to Shipped only when handover is recorded in Manifest." : ""}</p>

      <form className="toolbar" role="search">
        <input type="hidden" name="stage" value={stage} />
        <input name="q" defaultValue={sp.q} placeholder="Search order, AWB, SKU or pincode" aria-label="Search" className="inp grow" inputMode="search" />
        <details className="pop">
          <summary className="btn btn-secondary">Bulk search</summary>
          <div className="popbody"><label>Paste up to 200 order numbers or AWBs<textarea name="bulk" defaultValue={sp.bulk} rows={5} className="inp" /></label></div>
        </details>
        <label className="lbl">From<input type="date" name="from" defaultValue={sp.from} className="inp" /></label>
        <label className="lbl">To<input type="date" name="to" defaultValue={sp.to} className="inp" /></label>
        <details className="pop">
          <summary className="btn btn-secondary">More filters</summary>
          <div className="popbody">
            <label>Payment<select name="pay" defaultValue={sp.pay ?? ""} className="inp"><option value="">Any</option><option>PREPAID</option><option>COD</option></select></label>
            <label>Courier<select name="carrier" defaultValue={sp.carrier ?? ""} className="inp"><option value="">Any</option><option value="bluedart">Blue Dart</option><option value="BLUEDART">Blue Dart (booked)</option><option value="delhivery">Delhivery</option><option value="amazon">ATS / Amazon</option></select></label>
            <label>Warehouse<select disabled className="inp"><option>Jaipur (demo)</option></select></label>
            <label>Sort<select name="sort" defaultValue={sp.sort ?? "placed:desc"} className="inp"><option value="placed:desc">Newest first</option><option value="placed:asc">Oldest first</option><option value="value:desc">Highest value</option></select></label>
          </div>
        </details>
        <details className="pop">
          <summary className="btn btn-secondary">Columns</summary>
          <div className="popbody cols">
            {COLUMNS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" name="colpick" value={k} defaultChecked={cols.includes(k)} /> {l}</label>)}
            <p className="muted">Columns apply on Filter.</p>
          </div>
        </details>
        <button className="btn btn-primary">Filter</button>
        <Link href="/" className="linkbtn">Clear</Link>
      </form>

      <div className="desktop-only"><DispatchTable rows={data} cols={cols} canBulkHold={can(s.role, "order.hold")} /></div>

      <ul className="cards mobile-only" aria-label="Orders">
        {data.map(r => (
          <li key={r.ref}><Link href={`/orders/${r.ref}?tab=packing`} className="card">
            <div className="cardtop"><b>{r.ref}</b><span className={`chip ${r.payment === "COD" ? "amber" : "green"}`}>{r.payment}</span></div>
            <div>{r.city} {r.pincode}</div>
            <div className="cardchips"><span className={`chip ${r.readyTone}`}>{r.ready}</span><span className={`chip ${r.recTone}`}>{r.rec}</span></div>
            {r.awb && <code>{r.awb}</code>}
          </Link></li>
        ))}
        {data.length === 0 && <li className="empty">No orders in this stage.</li>}
      </ul>

      <div className="pager">
        <span>{rows.length} orders · page {page} of {pages}</span>
        {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-secondary">Previous</Link>}
        {page < pages && <Link href={href({ page: String(page + 1) })} className="btn btn-secondary">Next</Link>}
      </div>
    </div>
  );
}
