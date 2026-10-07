import { DEMO_SERVICES, SEED_RULESET, type AllocationContext, type AllocationInput, type Quote, type ShipmentSnapshot } from "../src";
export const NOW = new Date("2026-10-08T06:00:00Z");
export const FUTURE = new Date("2026-10-08T08:00:00Z");
export function ctx(over: Partial<AllocationContext> = {}): AllocationContext {
  const quotes = new Map<string, Quote>(DEMO_SERVICES.map(s => [s.id, { serviceId: s.id, amountPaise: 6000, currency: "INR", expiresAt: FUTURE, source: "demo" }]));
  return { now: NOW, ruleSet: SEED_RULESET, services: new Map(DEMO_SERVICES.map(s => [s.id, s])),
    serviceability: () => ({ serviceable: true, oda: false, source: "demo", version: "d1" }), quotes, blacklist: [], ...over };
}
export const order = (o: Partial<AllocationInput> = {}): AllocationInput => ({ orderRef: "SA-1001", payment: "PREPAID", direction: "FORWARD", intent: "STANDARD",
  rawShippingMethod: "Standard", destPincode: "302021", codAmountPaise: 0, packedWeightG: 550, box: { lengthCm: 22, breadthCm: 12, heightCm: 7 }, packingValidated: true, ...o });
export const snap = (o: Partial<ShipmentSnapshot> = {}): ShipmentSnapshot => ({
  businessRef: "SA-1001:1", lines: [{ variantId: "v-vs-1", qty: 1 }],
  destination: { name: "Demo Customer", line1: "1 Test Lane", city: "Pune", state: "MH", pincode: "411001", phone: "9000000000" },
  pickupWarehouseId: "wh-jaipur", payment: "PREPAID", codAmountPaise: 0, packedWeightG: 550,
  box: { code: "22x12x7_cm", lengthCm: 22, breadthCm: 12, heightCm: 7 }, serviceId: "bluedart.surface.prepaid",
  quote: { amountPaise: 6000, expiresAt: FUTURE.toISOString(), source: "demo" }, ...o });
