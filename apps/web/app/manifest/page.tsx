import { manifests } from "@/lib/store";
import { requireSession } from "@/lib/auth";
import { carrierLabel } from "@/lib/fmt";
import { ActionForm } from "@/components/ActionForm";
import { handover } from "../actions";

export const dynamic = "force-dynamic";
export default async function Manifest() {
  await requireSession();
  const batches = manifests();
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Manifest & handover</h1><p className="purpose">Group booked parcels by warehouse, courier and date, count them, and record handover.</p></div>
        <div className="headacts"><span className="sync">Local handover lists. Not official courier manifests. No pickup is requested.</span></div></div>
      {batches.length === 0 && <div className="panel empty">No booked parcels waiting for handover. Book orders in Dispatch first.</div>}
      {batches.map(b => (
        <section key={b.key} className="panel">
          <div className="paneltop"><h2>{carrierLabel[b.carrier]} · Jaipur (demo) · {b.dispatchDate}</h2><span className={`chip ${b.handedOver ? "green" : "amber"}`}>{b.handedOver ? "Handed over" : "Awaiting handover"}</span></div>
          <div className="steps">
            <span className="chip green">Local list prepared</span>
            <span className="chip grey">Courier manifest: {b.states.carrierManifest === "NOT_SUPPORTED" ? "not supported by adapter" : b.states.carrierManifest.toLowerCase()}</span>
            <span className="chip grey">Pickup: not requested</span>
          </div>
          <p>{b.awbs.length} parcels: {b.awbs.map(a => <code key={a}>{a}</code>)}</p>
          {b.missingLabels.length > 0 && <p className="msg bad">Label not printed: {b.missingLabels.join(", ")}</p>}
          {b.notScanned.length > 0 && <p className="msg bad">Not scanned: {b.notScanned.join(", ")}</p>}
          {!b.handedOver && <ActionForm action={handover.bind(null, b.key)} submit="Record handover" variant="primary" className="inline"><label>Parcels physically counted<input name="count" type="number" min={0} inputMode="numeric" className="inp" /></label></ActionForm>}
        </section>
      ))}
    </div>
  );
}
