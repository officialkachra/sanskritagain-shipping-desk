import "server-only";
import { allocate, assertCan, bookShipment, BOX_TYPES, checkApproval, diffRecommendation, MemoryLedger, SimulatedCarrier, snapshotHash, suggestPacking,
  DEMO_SERVICES, mergeEvents, currentStatus, trackingFreshness, addRemark, ndrActionGate, buildManifests,
  type Approval, type BookOutcome, type RecommendationSnapshot, type ShipmentSnapshot, type SimBehavior, type Carrier, type TrackingEvent,
  type NdrCase, type CarrierActionKind, type ManifestBatch } from "@shipdesk/core";
import { DEMO_ORDERS, DEMO_RULES, DEMO_SHIPMENTS, DEMO_SHIPPED_ORDERS, DEMO_CANCELLED, DEMO_NDR, demoContext, type DemoOrder, type DemoShipment } from "./demo-data";
import type { Session } from "./session";

// In-memory DEMO state (resets on server restart). Postgres-backed persistence replaces this before any real data.
export type Stage = "NEW_CASE" | "FULFILLMENT" | "AWB_GENERATED" | "READY_TO_SHIP" | "SHIPPED" | "ON_HOLD" | "CANCELLED";
export const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "NEW_CASE", label: "New", hint: "Imported; not packed yet" },
  { key: "FULFILLMENT", label: "Fulfillment", hint: "Packing recorded; awaiting approval/booking" },
  { key: "AWB_GENERATED", label: "AWB generated", hint: "Courier booking confirmed; label not yet printed/scanned" },
  { key: "READY_TO_SHIP", label: "Ready to ship", hint: "Label printed and parcel scanned; not handed over" },
  { key: "SHIPPED", label: "Shipped", hint: "Handover to courier recorded" },
  { key: "ON_HOLD", label: "On hold", hint: "Held by team with a reason" },
  { key: "CANCELLED", label: "Cancelled", hint: "Cancelled order" },
];

interface Packing { boxCode: string | null; weightG: number | null; preparedBy: string; stockChecked: boolean }
interface State {
  packing: Map<string, Packing>; approvals: Map<string, Approval>; holds: Map<string, string>; storedRec: Map<string, RecommendationSnapshot>;
  printed: Set<string>; scanned: Set<string>; handedOver: Map<string, { at: string; by: string }>; ndr: Map<string, NdrCase>;
  bookedAt: Map<string, Date>; audit: { at: string; actor: string; action: string; ref: string }[];
}
const g = globalThis as unknown as { __sd2?: State; __ledger2?: MemoryLedger; __adapters2?: Map<Carrier, SimulatedCarrier> };
const state: State = (g.__sd2 ??= { packing: new Map(), approvals: new Map(), holds: new Map(), storedRec: new Map(), printed: new Set(), scanned: new Set(),
  handedOver: new Map(), ndr: new Map(DEMO_NDR.map(n => [n.id, structuredClone(n)])), bookedAt: new Map(), audit: [] });
const ledger = (g.__ledger2 ??= new MemoryLedger());
const adapters = (g.__adapters2 ??= new Map((["BLUEDART", "DELHIVERY", "AMAZON_SHIPPING"] as Carrier[]).map(c => [c, new SimulatedCarrier(c, new Set(["book", "reconcileByReference", "ndrAction"]))])));

const audit = (actor: string, action: string, ref: string) => { state.audit.unshift({ at: new Date().toISOString(), actor, action, ref }); state.audit.length = Math.min(state.audit.length, 500); };
export const auditLog = () => state.audit;
export const businessRef = (ref: string) => `${ref}:1`;
export const ALL_ORDERS: DemoOrder[] = [...DEMO_SHIPPED_ORDERS, ...DEMO_ORDERS];
export const getOrder = (ref: string) => ALL_ORDERS.find(o => o.ref === ref) ?? null;
export const total = (o: DemoOrder) => o.lines.reduce((s, l) => s + l.qty * l.unitPricePaise, 0);
const seedShip = (ref: string) => DEMO_SHIPMENTS.find(s => s.orderRef === ref) ?? null;

export function packingFor(o: DemoOrder) {
  const suggestion = suggestPacking(o.lines.map(l => ({ variantId: l.variantId, qty: l.qty })), DEMO_RULES);
  const saved = state.packing.get(o.ref);
  return { ...(saved ?? { boxCode: suggestion.ok ? suggestion.boxCode : null, weightG: null, preparedBy: "", stockChecked: false }), suggestion, saved: !!saved };
}

function recommend(o: DemoOrder, p: Packing & { suggestion: ReturnType<typeof suggestPacking> }) {
  const box = BOX_TYPES.find(b => b.code === p.boxCode) ?? null;
  const rec = allocate({ orderRef: o.ref, payment: o.payment, direction: "FORWARD", intent: o.intent, rawShippingMethod: o.rawShippingMethod,
    destPincode: o.customer.pincode, codAmountPaise: o.payment === "COD" ? total(o) : 0, packedWeightG: p.weightG, box, packingValidated: p.suggestion.ok }, demoContext(p.weightG));
  if (!box) rec.reviewReasons.push("No box selected");
  if (!p.stockChecked) rec.reviewReasons.push("Stock not checked by packer");
  if (rec.status === "RECOMMENDED" && rec.reviewReasons.length) rec.status = "REVIEW_REQUIRED";
  return { rec, box };
}

export interface ShipmentView { awb: string; carrier: string; serviceId: string; bookedAt: Date; events: TrackingEvent[]; lastFetch: Date | null; fetchError: string | null; firstEdd: string | null; revisedEdd: string | null; synthetic: true; seeded: boolean }

function shipmentFor(o: DemoOrder): ShipmentView | null {
  const s = seedShip(o.ref);
  if (s) return { awb: s.awb, carrier: s.carrier, serviceId: s.serviceId, bookedAt: s.bookedAt, events: mergeEvents([], s.events).timeline, lastFetch: s.lastFetch, fetchError: s.fetchError, firstEdd: s.firstEdd, revisedEdd: s.revisedEdd, synthetic: true, seeded: true };
  const b = ledger.get(businessRef(o.ref));
  if (b?.state !== "CONFIRMED") return null;
  const svc = DEMO_SERVICES.find(x => x.id === b.serviceId)!;
  return { awb: b.awb!, carrier: svc.carrier, serviceId: b.serviceId, bookedAt: state.bookedAt.get(o.ref) ?? new Date(), events: [], lastFetch: null, fetchError: null, firstEdd: null, revisedEdd: null, synthetic: true, seeded: false };
}

export function view(o: DemoOrder) {
  const packing = packingFor(o);
  const { rec, box } = recommend(o, packing);
  const stored = state.storedRec.get(o.ref) ?? null;
  const recDiff = stored ? diffRecommendation(stored, rec) : [];
  const snap = buildSnapshot(o, packing, box, rec);
  const approval = state.approvals.get(businessRef(o.ref)) ?? null;
  const approvalCheck = snap ? checkApproval(approval, snap, new Date()) : { ok: false as const, reason: "NO_BOOKABLE_SNAPSHOT" };
  const booking = ledger.get(businessRef(o.ref)) ?? null;
  const shipment = shipmentFor(o);
  const hold = state.holds.get(o.ref) ?? null;
  const seeded = seedShip(o.ref);
  const printed = seeded?.labelPrinted || state.printed.has(o.ref);
  const scanned = seeded?.packedScanned || state.scanned.has(o.ref);
  const stage: Stage = DEMO_CANCELLED.has(o.ref) ? "CANCELLED" : hold ? "ON_HOLD"
    : (seeded?.stage === "SHIPPED" || state.handedOver.has(o.ref)) ? "SHIPPED"
    : shipment ? (printed && scanned ? "READY_TO_SHIP" : "AWB_GENERATED")
    : packing.weightG ? "FULFILLMENT" : "NEW_CASE";
  const ndr = [...state.ndr.values()].filter(n => n.orderRef === o.ref);
  return { order: o, packing, box, rec, stored, recDiff, snap, approval, approvalCheck, booking, shipment, hold, stage, printed, scanned, ndr, total: total(o),
    trackStatus: shipment ? currentStatus(shipment.events) : null, freshness: shipment ? trackingFreshness(shipment.events, shipment.lastFetch, new Date()) : null };
}
export type OrderView = ReturnType<typeof view>;
export const allViews = () => ALL_ORDERS.map(view);

function buildSnapshot(o: DemoOrder, p: Packing, box: (typeof BOX_TYPES)[number] | null, rec: RecommendationSnapshot): ShipmentSnapshot | null {
  const top = rec.eligible[0];
  if (rec.status !== "RECOMMENDED" || !top || !box || !p.weightG || !top.quote || top.quote.amountPaise === null) return null;
  return { businessRef: businessRef(o.ref), lines: o.lines.map(l => ({ variantId: l.variantId!, qty: l.qty })), destination: o.customer,
    pickupWarehouseId: "wh-jaipur-demo", payment: o.payment, codAmountPaise: o.payment === "COD" ? total(o) : 0, packedWeightG: p.weightG,
    box: { code: box.code, lengthCm: box.lengthCm, breadthCm: box.breadthCm, heightCm: box.heightCm }, serviceId: top.serviceId,
    quote: { amountPaise: top.quote.amountPaise, expiresAt: new Date(Math.floor(top.quote.expiresAt.getTime() / 3600e3) * 3600e3).toISOString(), source: top.quote.source } };
}

// ---------- Mutations: every one checks permission server-side ----------
const editable = (ref: string) => { const o = getOrder(ref); if (!o) throw new Error("Unknown order"); const v = view(o); if (["SHIPPED", "CANCELLED", "AWB_GENERATED", "READY_TO_SHIP"].includes(v.stage)) throw new Error(`Order is ${v.stage}; packing is locked`); return { o, v }; };

export function savePacking(s: Session, ref: string, boxCode: string | null, weightG: number | null, stockChecked: boolean) {
  assertCan(s.role, "packing.edit"); const { o } = editable(ref);
  state.packing.set(ref, { boxCode, weightG, stockChecked, preparedBy: s.user });
  if (!state.storedRec.has(ref)) state.storedRec.set(ref, view(o).rec);
  audit(s.user, `Packing saved: box ${boxCode ?? "none"}, ${weightG ?? "?"} g, stock ${stockChecked ? "checked" : "not checked"}`, ref);
}
export function setHold(s: Session, ref: string, reason: string) { assertCan(s.role, "order.hold"); editable(ref); state.holds.set(ref, reason || "No reason given"); audit(s.user, `Put on hold: ${reason || "No reason given"}`, ref); }
export function releaseHold(s: Session, ref: string) { assertCan(s.role, "order.release"); state.holds.delete(ref); audit(s.user, "Released from hold", ref); }
export function rerun(s: Session, ref: string): string[] {
  assertCan(s.role, "recommendation.rerun"); const o = getOrder(ref); if (!o) throw new Error("Unknown order");
  const v = view(o); const d = v.stored ? diffRecommendation(v.stored, v.rec) : ["First recommendation stored"];
  state.storedRec.set(ref, v.rec); audit(s.user, `Recommendation rerun (no booking): ${d.join("; ") || "no change"}`, ref); return d;
}
export function approve(s: Session, ref: string) {
  assertCan(s.role, "booking.approve"); const o = getOrder(ref); if (!o) throw new Error("Unknown order");
  const v = view(o); if (!v.snap) throw new Error("Order is not ready to approve");
  state.approvals.set(v.snap.businessRef, { id: `appr-${Date.now()}`, businessRef: v.snap.businessRef, snapshotHash: snapshotHash(v.snap), approvedBy: s.user, role: s.role, approvedAt: new Date(), batchId: null });
  audit(s.user, `Approved ${v.snap.serviceId} at ₹${(v.snap.quote.amountPaise / 100).toFixed(2)} (synthetic quote)`, ref);
}
export async function book(s: Session, ref: string, behavior: SimBehavior): Promise<BookOutcome> {
  assertCan(s.role, "booking.book"); const o = getOrder(ref); if (!o) throw new Error("Unknown order");
  const v = view(o); if (!v.snap) return { kind: "BLOCKED", reason: "Order is not ready to book" };
  const carrier = DEMO_SERVICES.find(x => x.id === v.snap!.serviceId)!.carrier;
  const ad = adapters.get(carrier)!; ad.behavior = behavior;
  const out = await bookShipment({ snapshot: v.snap, approval: v.approval, adapter: ad, ledger, gates: { liveWriteEnabled: false }, now: new Date() });
  if (out.kind === "CONFIRMED" && !state.bookedAt.has(ref)) state.bookedAt.set(ref, new Date());
  audit(s.user, `Book [DEMO, simulate ${behavior}] → ${out.kind}${"awb" in out ? ` ${out.awb}${out.reused ? " (existing booking found; not booked again)" : ""}` : ""}${"reason" in out ? `: ${out.reason}` : ""}`, ref);
  return out;
}
export function printLabel(s: Session, ref: string) {
  assertCan(s.role, "label.print_existing"); const o = getOrder(ref); if (!o) throw new Error("Unknown order");
  if (!view(o).shipment) throw new Error("No confirmed booking — nothing to print");
  state.printed.add(ref); audit(s.user, "Printed existing label (synthetic preview; no booking call)", ref);
}
export function scanPacked(s: Session, ref: string) {
  assertCan(s.role, "manifest.prepare"); const o = getOrder(ref); if (!o) throw new Error("Unknown order");
  if (!view(o).shipment) throw new Error("No confirmed booking"); state.scanned.add(ref); audit(s.user, "Parcel scanned for dispatch", ref);
}

// ---------- Bulk: selected records only, per-order outcome ----------
export type BulkResult = { ref: string; ok: boolean; message: string }[];
export function bulk(s: Session, refs: string[], op: "hold" | "rerun", reason = ""): BulkResult {
  return refs.slice(0, 200).map(ref => {
    try { if (op === "hold") { setHold(s, ref, reason); return { ref, ok: true, message: "Held" }; } const d = rerun(s, ref); return { ref, ok: true, message: d.join("; ") || "No change" }; }
    catch (e) { return { ref, ok: false, message: (e as Error).message }; }
  });
}

// ---------- NDR ----------
export const ndrCases = () => [...state.ndr.values()];
export function ndrRemark(s: Session, id: string, text: string) { assertCan(s.role, "ndr.remark"); const c = state.ndr.get(id); if (!c) throw new Error("Unknown case"); state.ndr.set(id, addRemark(c, s.user, text)); audit(s.user, `NDR remark (local only, nothing sent): ${text}`, c.orderRef); }
export function ndrAssign(s: Session, id: string, who: string) { assertCan(s.role, "ndr.assign"); const c = state.ndr.get(id); if (!c) throw new Error("Unknown case"); state.ndr.set(id, { ...c, assignee: who || null }); audit(s.user, `NDR assigned to ${who || "nobody"}`, c.orderRef); }
export function ndrGate(s: Session, c: NdrCase, kind: CarrierActionKind) {
  const o = getOrder(c.orderRef); const ts = o ? view(o).trackStatus : null;
  return ndrActionGate({ c, kind, role: s.role, adapterSupports: cap => adapters.get(c.carrier as Carrier)?.supports(cap) ?? false, currentTrackingStatus: ts, liveWriteEnabled: false, mode: "DEMO" });
}
export function ndrAction(s: Session, id: string, kind: CarrierActionKind, payload: Record<string, string>) {
  const c = state.ndr.get(id); if (!c) throw new Error("Unknown case");
  const gate = ndrGate(s, c, kind); if (!gate.allowed) throw new Error(gate.reason);
  const outcome = c.attempts >= 2 && kind === "REATTEMPT" ? "REJECTED" : "ACCEPTED"; // synthetic outcome
  state.ndr.set(id, { ...c, status: "ACTION_PENDING", actions: [...c.actions, { at: new Date().toISOString(), by: s.user, kind, payload, outcome, note: "SIMULATED in DEMO — no courier contacted" }] });
  audit(s.user, `NDR ${kind} simulated → ${outcome} (DEMO, nothing sent)`, c.orderRef);
}
export function ndrResolve(s: Session, id: string, evidence: string) { assertCan(s.role, "ndr.carrier_action"); const c = state.ndr.get(id); if (!c) throw new Error("Unknown case"); if (!evidence.trim()) throw new Error("Evidence required to close"); state.ndr.set(id, { ...c, status: "RESOLVED", remarks: [...c.remarks, { at: new Date().toISOString(), by: s.user, text: `Resolved: ${evidence}` }] }); audit(s.user, `NDR resolved: ${evidence}`, c.orderRef); }

// ---------- Manifest ----------
export function manifests(): (ManifestBatch & { handedOver: boolean })[] {
  const rows = allViews().filter(v => v.shipment && v.stage !== "CANCELLED" && !(seedShip(v.order.ref)?.stage === "SHIPPED")).map(v => ({
    awb: v.shipment!.awb, orderRef: v.order.ref, carrier: v.shipment!.carrier, warehouseId: "wh-jaipur-demo", bookedAt: v.shipment!.bookedAt, labelPrinted: !!v.printed, packedScanned: !!v.scanned }));
  return buildManifests(rows, () => false).map(b => ({ ...b, handedOver: b.awbs.every(a => [...state.handedOver.keys()].some(r => view(getOrder(r)!).shipment?.awb === a)) }));
}
export function recordHandover(s: Session, key: string, confirmCount: number) {
  assertCan(s.role, "manifest.prepare"); const b = manifests().find(m => m.key === key); if (!b) throw new Error("Unknown batch");
  if (b.missingLabels.length || b.notScanned.length) throw new Error("Batch has missing labels or unscanned parcels");
  if (confirmCount !== b.awbs.length) throw new Error(`Counted ${confirmCount}, batch has ${b.awbs.length}. Recount before handover.`);
  for (const v of allViews()) if (v.shipment && b.awbs.includes(v.shipment.awb)) state.handedOver.set(v.order.ref, { at: new Date().toISOString(), by: s.user });
  audit(s.user, `Handover recorded locally for ${b.awbs.length} parcels (${b.carrier}); no pickup API called`, key);
}
export type { DemoShipment };
