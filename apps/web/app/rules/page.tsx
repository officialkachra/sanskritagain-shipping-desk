import { BOX_TYPES, LEGACY_DEFAULT_BOX, PACKING_REFERENCE, SEED_RULESET, DEMO_SERVICES } from "@shipdesk/core";
import { requireSession } from "@/lib/auth";
import { svcLabel } from "@/lib/fmt";

export default async function Rules() {
  await requireSession();
  return (
    <>
      <h1>Rules and boxes</h1>
      <section className="panel">
        <h2>Courier order ({SEED_RULESET.version})</h2>
        <p className="muted">{SEED_RULESET.note}</p>
        {SEED_RULESET.policies.map(p => (
          <div key={p.id} className="policy">
            <h3>{p.name} <span className={`st ${p.state === "ACTIVE" ? "RECOMMENDED" : "REVIEW_REQUIRED"}`}>{p.state === "ACTIVE" ? "Active" : "Draft, not verified"}</span></h3>
            <ol className="ladder small">{p.orderedServiceIds.map((id, i) => <li key={id} className="ok"><span className="p">P{i + 1}</span><span className="name">{svcLabel[id]}</span></li>)}</ol>
            <p className="muted">{p.provenance}</p>
          </div>
        ))}
        <p className="muted">Express orders have no policy yet, so every Express order goes to review.</p>
      </section>
      <section className="panel">
        <h2>Courier services</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Service</th><th>Payments</th><th>Max weight</th><th>Volumetric divisor</th><th>Slab</th></tr></thead>
          <tbody>{DEMO_SERVICES.map(s => <tr key={s.id}><td>{s.label}</td><td>{s.payments.join(", ")}</td><td>{s.maxWeightG ?? "unknown"}</td><td>{s.volumetricDivisor ?? "unknown"}</td><td>{s.slabG ?? "unknown"}</td></tr>)}</tbody>
        </table></div>
        <p className="muted">“Unknown” stays unknown until the courier rate contract is loaded. Nothing is guessed.</p>
      </section>
      <section className="panel">
        <h2>Box types</h2>
        <div className="boxes">
          {BOX_TYPES.map(b => <div key={b.code} className="box" style={{ ["--w" as string]: b.lengthCm, ["--h" as string]: b.breadthCm }}><span>{b.lengthCm}×{b.breadthCm}×{b.heightCm}</span></div>)}
        </div>
        <p className="muted">Legacy default {LEGACY_DEFAULT_BOX.lengthCm}×{LEGACY_DEFAULT_BOX.breadthCm}×{LEGACY_DEFAULT_BOX.heightCm} cm is kept unchanged and never assigned automatically. Tare weights are not measured yet.</p>
      </section>
      <section className="panel">
        <h2>Packing reference (not active)</h2>
        <p className="muted">Owner-provided weights. Each row needs an exact variant mapping and confirmation that the weight includes packaging before it is used.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Item set</th><th className="num">Stated weight</th><th>Box</th><th>Note</th></tr></thead>
          <tbody>{PACKING_REFERENCE.map(r => <tr key={r.description}><td>{r.description}</td><td className="num">{r.statedWeightG} g</td><td>{r.boxCode.replace("_cm", " cm")}</td><td>{r.note ?? ""}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
