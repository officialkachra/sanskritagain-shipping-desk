import "server-only";
import { allocate, bookShipment, BOX_TYPES, checkApproval, MemoryLedger, SimulatedCarrier, snapshotHash, suggestPacking, DEMO_SERVICES,
  type Approval, type BookOutcome, type RecommendationSnapshot, type ShipmentSnapshot, type SimBehavior, type Carrier } from "@shipdesk/core";
import { DEMO_ORDERS, DEMO_RULES, demoContext, type DemoOrder } from "./demo-data";

// In-memory DEMO state. Resets when the server instance restarts. Postgres ledger replaces this in Phase 1 slice 2.
type Stage = "NEW_CASE" | "FULFILLMENT" | "AWB_GENERATED" | "ON_HOLD";
interface Packing { boxCode: string | null; weightG: number | null; preparedBy: string; stockChecked: boolean }
interface State { packing: Map<string, Packing>; approvals: Map<string, Approval>; holds: Map<string, string>; audit: { at: string; actor: string; action: string; ref: string }[] }
const g = globalThis as unknown as { __sd?: State; __ledger?: MemoryLedger; __adapters?: Map<Carrier, SimulatedCarrier> };
const state: State = (g.__sd ??= { packing: new Map(), approvals: new Map(), holds: new Map(), audit: [] });
export const ledger = (g.__ledger ??= new MemoryLedger());
const adapters = (g.__adapters ??= new Map((["BLUEDART", "DELHIVERY", "AMAZON_SHIPPING"] as Carrier[]).map(c => [c, new SimulatedCarrier(c, new Set(["book", "reconcileByReference"]))])));

export const audit = (actor: string, action: string, ref: string) => { state.audit.unshift({ at: new Date().toISOString(), actor, action, ref }); state.audit.length = Math.min(state.audit.length, 200); };
export const auditLog = () => state.audit;
export const businessRef = (ref: string) => `${ref}:1`;

export function getOrder(ref: string) { return DEMO_ORDERS.find(o => o.ref === ref) ?? null; }

export function packingFor(o: DemoOrder): Packing & { suggestion: ReturnType<typeof suggestPacking> } {
  const suggestion = suggestPacking(o.lines.map(l => ({ variantId: l.variantId, qty: l.qty })), DEMO_RULES);
  const saved = state.packing.get(o.ref);
  if (saved) return { ...saved, suggestion };
  return { boxCode: suggestion.ok ? suggestion.boxCode : null, weightG: null, preparedBy: "", stockChecked: false, suggestion };
}

export function view(o: DemoOrder) {
  const p = packingFor(o);
  const box = BOX_TYPES.find(b => b.code === p.boxCode) ?? null;
  const rec: RecommendationSnapshot = allocate({ orderRef: o.ref, payment: o.payment, direction: "FORWARD", intent: o.intent, rawShippingMethod: o.rawShippingMethod,
    destPincode: o.customer.pincode, codAmountPaise: o.payment === "COD" ? total(o) : 0, packedWeightG: p.weightG, box, packingValidated: p.suggestion.ok }, demoContext(p.weightG));
  if (box === null) rec.reviewReasons.push("No box selected");
  if (!p.stockChecked) rec.reviewReasons.push("Stock not checked by packer");
  if (rec.status === "RECOMMENDED" && rec.reviewReasons.length) rec.status = "REVIEW_REQUIRED";
  const snap = buildSnapshot(o, p, box, rec);
  const approval = state.approvals.get(businessRef(o.ref)) ?? null;
  const approvalCheck = snap ? checkApproval(approval, snap, new Date()) : { ok: false as const, reason: "NO_BOOKABLE_SNAPSHOT" };
  const booking = ledger.get(businessRef(o.ref)) ?? null;
  const hold = state.holds.get(o.ref) ?? null;
  const stage: Stage = hold ? "ON_HOLD" : booking?.state === "CONFIRMED" ? "AWB_GENERATED" : p.weightG ? "FULFILLMENT" : "NEW_CASE";
  return { order: o, packing: p, box, rec, snap, approval, approvalCheck, booking, hold, stage, total: total(o) };
}

export const total = (o: DemoOrder) => o.lines.reduce((s, l) => s + l.qty * l.unitPricePaise, 0);

function buildSnapshot(o: DemoOrder, p: Packing, box: (typeof BOX_TYPES)[number] | null, rec: RecommendationSnapshot): ShipmentSnapshot | null {
  const top = rec.eligible[0];
  if (rec.status !== "RECOMMENDED" || !top || !box || !p.weightG || !top.quote || top.quote.amountPaise === null) return null;
  return { businessRef: businessRef(o.ref), lines: o.lines.map(l => ({ variantId: l.variantId!, qty: l.qty })), destination: o.customer,
    pickupWarehouseId: "wh-jaipur-demo", payment: o.payment, codAmountPaise: o.payment === "COD" ? total(o) : 0, packedWeightG: p.weightG,
    box: { code: box.code, lengthCm: box.lengthCm, breadthCm: box.breadthCm, heightCm: box.heightCm }, serviceId: top.serviceId,
    quote: { amountPaise: top.quote.amountPaise, expiresAt: roundHour(top.quote.expiresAt), source: top.quote.source } };
}
// Quote expiry rounded to the hour so the demo snapshot hash is stable across page loads within the quote window.
const roundHour = (d: Date) => new Date(Math.floor(d.getTime() / 3600e3) * 3600e3).toISOString();

export function savePacking(ref: string, boxCode: string | null, weightG: number | null, stockChecked: boolean, actor: string) {
  state.packing.set(ref, { boxCode, weightG, stockChecked, preparedBy: actor });
  audit(actor, `Packing saved: box ${boxCode ?? "none"}, ${weightG ?? "?"} g, stock ${stockChecked ? "checked" : "not checked"}`, ref);
}
export function setHold(ref: string, reason: string | null, actor: string) {
  if (reason) state.holds.set(ref, reason); else state.holds.delete(ref);
  audit(actor, reason ? `Put on hold: ${reason}` : "Released from hold", ref);
}
export function approve(ref: string, actor: string, role: string) {
  const o = getOrder(ref); if (!o) throw new Error("Unknown order");
  const v = view(o); if (!v.snap) throw new Error("Order is not ready to approve");
  state.approvals.set(v.snap.businessRef, { id: `appr-${Date.now()}`, businessRef: v.snap.businessRef, snapshotHash: snapshotHash(v.snap), approvedBy: actor, role, approvedAt: new Date(), batchId: null });
  audit(actor, `Approved ${v.snap.serviceId} at ₹${(v.snap.quote.amountPaise / 100).toFixed(2)}`, ref);
}
export async function book(ref: string, actor: string, behavior: SimBehavior): Promise<BookOutcome> {
  const o = getOrder(ref); if (!o) throw new Error("Unknown order");
  const v = view(o); if (!v.snap) return { kind: "BLOCKED", reason: "Order is not ready to book" };
  const carrier = DEMO_SERVICES.find(s => s.id === v.snap!.serviceId)!.carrier;
  const ad = adapters.get(carrier)!; ad.behavior = behavior;
  const out = await bookShipment({ snapshot: v.snap, approval: v.approval, adapter: ad, ledger, gates: { liveWriteEnabled: false }, now: new Date() });
  audit(actor, `Book (${behavior}) → ${out.kind}${"awb" in out ? ` ${out.awb}${out.reused ? " (found existing booking, not booked again)" : ""}` : ""}${"reason" in out ? `: ${out.reason}` : ""}`, ref);
  return out;
}
