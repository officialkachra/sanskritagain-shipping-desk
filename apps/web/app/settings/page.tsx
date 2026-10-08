import { BOX_TYPES, LEGACY_DEFAULT_BOX, PACKING_REFERENCE, DEMO_SERVICES, integrationStatus, can, type Action } from "@shipdesk/core";
import Link from "next/link";
import { requireCan } from "@/lib/auth";
import { auditLog } from "@/lib/store";
import { ist } from "@/lib/fmt";

export const dynamic = "force-dynamic";
const ACTIONS: Action[] = ["packing.edit", "order.hold", "order.release", "recommendation.rerun", "booking.approve", "booking.book", "label.print_existing", "export.pii", "ndr.remark", "ndr.assign", "ndr.carrier_action", "manifest.prepare", "import.run"];
const stateText: Record<string, [string, string]> = { NOT_CONFIGURED: ["Not configured", "grey"], CONFIGURED_CONTRACT_UNVERIFIED: ["Configured, contract not verified", "amber"], READY_READ: ["Live read", "blue"], READY_WRITE: ["Live write", "red"] };

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireCan("order.view");
  const { tab = "integrations" } = await searchParams;
  const ints = integrationStatus(process.env as Record<string, string | undefined>);
  const T = [["integrations", "Integrations"], ["roles", "Users & roles"], ["warehouses", "Warehouses"], ["packing", "Boxes & mappings"], ["carriers", "Carrier services"], ["jobs", "Sync & jobs"], ["audit", "Audit log"]];
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Settings</h1><p className="purpose">Configuration status. Secret values are never shown.</p></div></div>
      <nav className="tabs">{T.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={k === tab ? "on" : ""}>{l}</Link>)}</nav>
      <section className="panel">
        {tab === "integrations" && <div className="tablewrap"><table className="grid"><thead><tr><th>Integration</th><th>Status</th><th>Live read</th><th>Live write</th><th>Missing settings</th><th>Note</th></tr></thead>
          <tbody>{ints.map(i => <tr key={i.key}><td>{i.label}</td><td><span className={`chip ${stateText[i.state]![1]}`}>{stateText[i.state]![0]}</span></td><td>{i.readSwitch ? "On" : "Off"}</td><td>{i.writeSwitch ? "On" : "Off"}</td><td className="wrap">{i.missing.map(m => <code key={m}>{m}</code>)}</td><td className="wrap">{i.note}</td></tr>)}</tbody></table></div>}
        {tab === "roles" && <div className="tablewrap"><table className="grid"><thead><tr><th>Permission</th><th>Admin</th><th>Packer</th><th>Support</th></tr></thead>
          <tbody>{ACTIONS.map(a => <tr key={a}><td><code>{a}</code></td>{(["ADMIN", "PACKER", "SUPPORT"] as const).map(r => <td key={r}>{can(r, a) ? "Yes" : "—"}</td>)}</tr>)}</tbody></table>
          <p className="muted">Enforced on the server for every action. Demo users only; production needs a maintained auth library with MFA and session revocation.</p></div>}
        {tab === "warehouses" && <dl className="snap"><dt>Jaipur (demo)</dt><dd>Pickup address and GSTIN come from private configuration, not this demo.</dd></dl>}
        {tab === "packing" && <>
          <h2>Box types</h2><div className="boxes">{BOX_TYPES.map(b => <div key={b.code} className="box" style={{ ["--w" as string]: b.lengthCm, ["--h" as string]: b.breadthCm }}><span>{b.lengthCm}×{b.breadthCm}×{b.heightCm}</span></div>)}</div>
          <p className="muted">Legacy default {LEGACY_DEFAULT_BOX.lengthCm}×{LEGACY_DEFAULT_BOX.breadthCm}×{LEGACY_DEFAULT_BOX.heightCm} cm is kept but never auto-assigned. Tare weights not measured. Shopify “Packed product size” is not read yet; its API field and units must be verified first.</p>
          <h2>Packing reference (not active)</h2>
          <div className="tablewrap"><table className="grid"><thead><tr><th>Item set</th><th className="num">Stated weight</th><th>Box</th><th>Note</th></tr></thead>
            <tbody>{PACKING_REFERENCE.map(r => <tr key={r.description}><td>{r.description}</td><td className="num">{r.statedWeightG} g</td><td>{r.boxCode.replace("_cm", " cm")}</td><td>{r.note ?? "Needs variant mapping + packaging basis"}</td></tr>)}</tbody></table></div></>}
        {tab === "carriers" && <div className="tablewrap"><table className="grid"><thead><tr><th>Service</th><th>Payments</th><th>Max weight</th><th>Volumetric divisor</th><th>Slab</th><th>Capabilities</th></tr></thead>
          <tbody>{DEMO_SERVICES.map(s => <tr key={s.id}><td>{s.label}</td><td>{s.payments.join(", ")}</td><td>{s.maxWeightG ?? "unknown"}</td><td>{s.volumetricDivisor ?? "unknown"}</td><td>{s.slabG ?? "unknown"}</td><td>Demo adapter only; live contract not verified</td></tr>)}</tbody></table></div>}
        {tab === "jobs" && <p className="muted">No Shopify sync or background worker is running. Webhook verification and order mapping are built and tested in the core package; a durable worker with Postgres is needed before real sync.</p>}
        {tab === "audit" && <ul className="log">{auditLog().slice(0, 100).map((a, i) => <li key={i}><time>{ist(a.at)}</time> {a.actor} · {a.ref}: {a.action}</li>)}{!auditLog().length && <li className="muted">No actions in this demo session.</li>}</ul>}
      </section>
    </div>
  );
}
