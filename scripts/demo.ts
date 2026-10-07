import { allocate, DEMO_SERVICES, SEED_RULESET, bookShipment, MemoryLedger, SimulatedCarrier, snapshotHash, SEED_SERVICE_IDS as S, type Quote, type ShipmentSnapshot } from "../packages/core/src";
const now = new Date(); const exp = new Date(now.getTime() + 3600e3);
const quotes = new Map<string, Quote>(DEMO_SERVICES.map((s, i) => [s.id, { serviceId: s.id, amountPaise: 5500 + i * 400, currency: "INR", expiresAt: exp, source: "DEMO synthetic" }]));
const ctx = { now, ruleSet: SEED_RULESET, services: new Map(DEMO_SERVICES.map(s => [s.id, s])), quotes, blacklist: [],
  serviceability: (sid: string, pin: string) => ({ serviceable: (pin === "560064" && sid === S.BD_SURFACE_PREPAID ? false : true) as boolean, oda: false as const, source: "DEMO", version: "demo-1" }) };
const orders = [
  { orderRef: "DEMO-1001", payment: "PREPAID", direction: "FORWARD", intent: "STANDARD", rawShippingMethod: "Standard", destPincode: "411001", codAmountPaise: 0, packedWeightG: 550, box: { lengthCm: 22, breadthCm: 12, heightCm: 7 }, packingValidated: true },
  { orderRef: "DEMO-1002", payment: "PREPAID", direction: "FORWARD", intent: "STANDARD", rawShippingMethod: "Standard", destPincode: "560064", codAmountPaise: 0, packedWeightG: 200, box: { lengthCm: 18, breadthCm: 12, heightCm: 7 }, packingValidated: true },
  { orderRef: "DEMO-1003", payment: "COD", direction: "FORWARD", intent: "STANDARD", rawShippingMethod: "Standard", destPincode: "110001", codAmountPaise: 59900, packedWeightG: 1030, box: { lengthCm: 26, breadthCm: 13, heightCm: 10 }, packingValidated: true },
  { orderRef: "DEMO-1004", payment: "PREPAID", direction: "FORWARD", intent: "EXPRESS", rawShippingMethod: "Express Shipping", destPincode: "400001", codAmountPaise: 0, packedWeightG: 550, box: null, packingValidated: false },
] as const;
console.log("MODE: DEMO — synthetic data, no carrier contacted\n");
for (const o of orders) {
  const r = allocate({ ...o, box: o.box ? { ...o.box } : null }, ctx);
  console.log(`${o.orderRef} → ${r.status}${r.eligible[0] ? ` | P${r.eligible[0].priority} ${r.eligible[0].serviceId}` : ""}`);
  r.trace.forEach(t => console.log("   ·", t)); r.reviewReasons.forEach(t => console.log("   ⚠", t));
}
const snap: ShipmentSnapshot = { businessRef: "DEMO-1001:1", lines: [{ variantId: "demo-vs-1", qty: 1 }], destination: { name: "Demo Customer", line1: "1 Test Lane", city: "Pune", state: "MH", pincode: "411001", phone: "9000000000" },
  pickupWarehouseId: "wh-demo", payment: "PREPAID", codAmountPaise: 0, packedWeightG: 550, box: { code: "22x12x7_cm", lengthCm: 22, breadthCm: 12, heightCm: 7 }, serviceId: S.BD_SURFACE_PREPAID,
  quote: { amountPaise: 5500, expiresAt: exp.toISOString(), source: "DEMO" } };
const ledger = new MemoryLedger(); const ad = new SimulatedCarrier("BLUEDART", new Set(["book", "reconcileByReference"]), "TIMEOUT_BUT_BOOKED");
const approval = { id: "demo-appr", businessRef: snap.businessRef, snapshotHash: snapshotHash(snap), approvedBy: "demo-admin", role: "ADMIN", approvedAt: now, batchId: null };
(async () => {
  console.log("\nBooking DEMO-1001 (simulated timeout-but-booked):");
  console.log("  attempt 1:", await bookShipment({ snapshot: snap, approval, adapter: ad, ledger, gates: { liveWriteEnabled: false }, now }));
  console.log("  attempt 2:", await bookShipment({ snapshot: snap, approval, adapter: ad, ledger, gates: { liveWriteEnabled: false }, now }));
  console.log("  carrier book() calls:", ad.calls);
})();
