import "server-only";
import { DEMO_SERVICES, type TrackingEvent, type CanonicalStatus, type NdrCase, SEED_RULESET, SEED_SERVICE_IDS as S, type AllocationContext, type BundlePackingRule, type Quote, type ServiceabilityResult, type ShippingIntent, type PaymentMode } from "@shipdesk/core";

// ALL DATA BELOW IS SYNTHETIC. No real customers, orders, rates or serviceability.
export interface DemoLine { variantId: string | null; title: string; qty: number; unitPricePaise: number }
export interface DemoOrder {
  ref: string; placedAt: string; payment: PaymentMode; intent: ShippingIntent; rawShippingMethod: string | null;
  customer: { name: string; line1: string; city: string; state: string; pincode: string; phone: string };
  lines: DemoLine[]; tags: string[];
}

export const VARIANTS: Record<string, string> = {
  "demo-vs-hi-1": "Vishnu Sahasranama (Hindi)", "demo-sk-hi-1": "Sundarkand (Hindi)", "demo-hc-hi": "Hanuman Chalisa (Hindi)",
  "demo-bb-hi": "Bajrang Baan (Hindi)", "demo-lal-sa": "Lalita Sahasranama (Sanskrit)", "demo-bhk-kn": "Bhaktamar (Kannada)",
};

/** Synthetic DEMO-only packing rules (stand-ins until real SKU mapping is validated by packers/admin). */
export const DEMO_RULES: BundlePackingRule[] = [
  { id: "demo-r-vs1", version: 1, components: [{ variantId: "demo-vs-hi-1", qty: 1 }], packageWeightG: 550, boxCode: "22x12x7_cm", weightIncludesPackaging: true, approvedBy: "demo", approvedAt: new Date(0) },
  { id: "demo-r-sk1", version: 1, components: [{ variantId: "demo-sk-hi-1", qty: 1 }], packageWeightG: 550, boxCode: "23x10x7_cm", weightIncludesPackaging: true, approvedBy: "demo", approvedAt: new Date(0) },
  { id: "demo-r-hcbb", version: 1, components: [{ variantId: "demo-hc-hi", qty: 1 }, { variantId: "demo-bb-hi", qty: 1 }], packageWeightG: 200, boxCode: "18x12x7_cm", weightIncludesPackaging: true, approvedBy: "demo", approvedAt: new Date(0) },
  { id: "demo-r-sk2", version: 1, components: [{ variantId: "demo-sk-hi-1", qty: 2 }], packageWeightG: 1030, boxCode: "26x13x10_cm", weightIncludesPackaging: true, approvedBy: "demo", approvedAt: new Date(0) },
  { id: "demo-r-sklal", version: 1, components: [{ variantId: "demo-sk-hi-1", qty: 1 }, { variantId: "demo-lal-sa", qty: 1 }], packageWeightG: 800, boxCode: "26x13x10_cm", weightIncludesPackaging: true, approvedBy: "demo", approvedAt: new Date(0) },
  { id: "demo-r-bhk", version: 1, components: [{ variantId: "demo-bhk-kn", qty: 1 }], packageWeightG: 150, boxCode: "18x12x7_cm", weightIncludesPackaging: true, approvedBy: "demo", approvedAt: new Date(0) },
];

const c = (n: string, city: string, state: string, pincode: string) => ({ name: `Demo Customer ${n}`, line1: `${n}-12 Sample Colony`, city, state, pincode, phone: "9000000000" });
const L = (v: string | null, qty: number, price = 49900): DemoLine => ({ variantId: v, title: v ? VARIANTS[v]! : "Unmapped item (no variant ID)", qty, unitPricePaise: price });

export const DEMO_ORDERS: DemoOrder[] = [
  { ref: "DEMO-1001", placedAt: "2026-10-08T03:10:00Z", payment: "PREPAID", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("A", "Pune", "Maharashtra", "411001"), lines: [L("demo-vs-hi-1", 1)], tags: ["hindi"] },
  { ref: "DEMO-1002", placedAt: "2026-10-08T03:25:00Z", payment: "PREPAID", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("B", "Bengaluru", "Karnataka", "560064"), lines: [L("demo-hc-hi", 1, 29900), L("demo-bb-hi", 1, 29900)], tags: [] },
  { ref: "DEMO-1003", placedAt: "2026-10-08T03:40:00Z", payment: "COD", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("C", "New Delhi", "Delhi", "110001"), lines: [L("demo-sk-hi-1", 2)], tags: ["cod"] },
  { ref: "DEMO-1004", placedAt: "2026-10-08T04:05:00Z", payment: "PREPAID", intent: "EXPRESS", rawShippingMethod: "Express Shipping", customer: c("D", "Mumbai", "Maharashtra", "400001"), lines: [L("demo-sk-hi-1", 1)], tags: ["express"] },
  { ref: "DEMO-1005", placedAt: "2026-10-08T04:20:00Z", payment: "PREPAID", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("E", "Shillong", "Meghalaya", "793001"), lines: [L("demo-sk-hi-1", 1), L("demo-lal-sa", 1)], tags: [] },
  { ref: "DEMO-1006", placedAt: "2026-10-08T04:45:00Z", payment: "PREPAID", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("F", "Mysuru", "Karnataka", "570001"), lines: [L(null, 1)], tags: ["needs-mapping"] },
  { ref: "DEMO-1007", placedAt: "2026-10-08T05:00:00Z", payment: "PREPAID", intent: "UNKNOWN", rawShippingMethod: "Free Delivery Weekend", customer: c("G", "Jaipur", "Rajasthan", "302021"), lines: [L("demo-bhk-kn", 1)], tags: [] },
  { ref: "DEMO-1008", placedAt: "2026-10-08T05:15:00Z", payment: "PREPAID", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("H", "Hyderabad", "Telangana", "500089"), lines: [L("demo-vs-hi-1", 1)], tags: [] },
  { ref: "DEMO-1009", placedAt: "2026-10-08T05:30:00Z", payment: "COD", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("I", "Lucknow", "Uttar Pradesh", "226001"), lines: [L("demo-hc-hi", 1, 29900), L("demo-bb-hi", 1, 29900)], tags: ["cod"] },
  { ref: "DEMO-1011", placedAt: "2026-10-08T06:05:00Z", payment: "COD", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("K", "Bengaluru", "Karnataka", "560064"), lines: [L("demo-vs-hi-1", 1)], tags: ["cod"] },
  { ref: "DEMO-1010", placedAt: "2026-10-08T05:50:00Z", payment: "PREPAID", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("J", "Kolkata", "West Bengal", "700001"), lines: [L("demo-sk-hi-1", 1)], tags: [] },
];

/** Synthetic serviceability. Not real carrier data. */
export function demoServiceability(serviceId: string, pincode: string): ServiceabilityResult {
  const base = { source: "DEMO synthetic", version: "demo-2026-10" };
  if (pincode.startsWith("79")) {
    if (serviceId === S.ATS || serviceId === S.BD_SURFACE_PREPAID || serviceId === S.BD_SURFACE_COD) return { serviceable: false, oda: false, ...base };
    if (serviceId === S.DELHIVERY) return { serviceable: "UNKNOWN", oda: "UNKNOWN", ...base };
    return { serviceable: true, oda: true, ...base };
  }
  return { serviceable: true, oda: false, ...base };
}

/** Synthetic quotes. ATS has no quote for heavy parcels to show "missing ≠ zero". */
export function demoQuotes(weightG: number | null, now: Date): Map<string, Quote> {
  const w = weightG ?? 500, slabs = Math.max(1, Math.ceil(w / 500)), exp = new Date(now.getTime() + 2 * 3600e3);
  const rate: Record<string, number> = { [S.BD_SURFACE_PREPAID]: 5200, [S.BD_SURFACE_COD]: 6400, [S.BD_AIR_PREPAID]: 9800, [S.ATS]: 4900, [S.DELHIVERY]: 5600 };
  return new Map(DEMO_SERVICES.map(s => [s.id, { serviceId: s.id, currency: "INR" as const, expiresAt: exp, source: "DEMO synthetic rate",
    amountPaise: s.id === S.ATS && w > 1000 ? null : rate[s.id]! * slabs }]));
}

export function demoContext(weightG: number | null, now = new Date()): AllocationContext {
  return { now, ruleSet: SEED_RULESET, services: new Map(DEMO_SERVICES.map(s => [s.id, s])), serviceability: demoServiceability, quotes: demoQuotes(weightG, now), blacklist: [] };
}

// ---- Synthetic shipments already past booking (tracking / NDR / manifest demos) ----
const H = 36e5;
const ago = (h: number) => new Date(Date.now() - h * H);
export interface DemoShipment {
  orderRef: string; awb: string; carrier: "BLUEDART" | "DELHIVERY" | "AMAZON_SHIPPING"; serviceId: string;
  stage: "AWB_GENERATED" | "READY_TO_SHIP" | "SHIPPED"; bookedAt: Date; labelPrinted: boolean; packedScanned: boolean;
  lastFetch: Date | null; fetchError: string | null; firstEdd: string | null; revisedEdd: string | null; events: TrackingEvent[];
}
const tev = (awb: string, carrier: string, hAgo: number, providerStatus: string, canonical: CanonicalStatus, location: string): TrackingEvent =>
  ({ carrier, awb, providerEventId: `${awb}-${hAgo}`, providerStatus, canonical, occurredAt: ago(hAgo), sourceTz: "Asia/Kolkata", location, receivedAt: ago(Math.max(0, hAgo - 0.2)) });
const day = (h: number) => ago(h).toISOString().slice(0, 10);

const mk = (orderRef: string, n: string, carrier: DemoShipment["carrier"], serviceId: string, bookedH: number, stage: DemoShipment["stage"],
  steps: [number, string, CanonicalStatus, string][], extra: Partial<DemoShipment> = {}): DemoShipment => {
  const awb = `DEMO-${carrier}-9${n}`;
  return { orderRef, awb, carrier, serviceId, stage, bookedAt: ago(bookedH), labelPrinted: stage !== "AWB_GENERATED", packedScanned: stage !== "AWB_GENERATED",
    lastFetch: ago(1), fetchError: null, firstEdd: day(-48), revisedEdd: null, events: steps.map(([h, ps, c, loc]) => tev(awb, carrier, h, ps, c, loc)), ...extra };
};

export const DEMO_SHIPMENTS: DemoShipment[] = [
  mk("DEMO-0991", "00991", "BLUEDART", S.BD_SURFACE_PREPAID, 50, "SHIPPED", [[48, "Shipment picked up", "PICKED_UP", "Jaipur"], [30, "In transit - connected", "IN_TRANSIT", "Delhi hub"]]),
  mk("DEMO-0992", "00992", "DELHIVERY", S.DELHIVERY, 70, "SHIPPED", [[68, "Picked Up", "PICKED_UP", "Jaipur"], [40, "In Transit", "IN_TRANSIT", "Indore"], [3, "Dispatched for delivery", "OUT_FOR_DELIVERY", "Bhopal"]]),
  mk("DEMO-0993", "00993", "AMAZON_SHIPPING", S.ATS, 120, "SHIPPED", [[118, "PickupDone", "PICKED_UP", "Jaipur"], [80, "InTransit", "IN_TRANSIT", "Ahmedabad"], [30, "Delivered", "DELIVERED", "Surat"]]),
  mk("DEMO-0994", "00994", "DELHIVERY", S.DELHIVERY, 96, "SHIPPED", [[94, "Picked Up", "PICKED_UP", "Jaipur"], [50, "In Transit", "IN_TRANSIT", "Nagpur"], [20, "Consignee not reachable on phone", "NDR", "Raipur"]]),
  mk("DEMO-0995", "00995", "BLUEDART", S.BD_SURFACE_PREPAID, 200, "SHIPPED", [[198, "Shipment picked up", "PICKED_UP", "Jaipur"], [150, "Customer refused delivery", "NDR", "Patna"], [126, "Customer refused delivery", "NDR", "Patna"], [100, "RTO initiated", "RTO_INITIATED", "Patna"]]),
  mk("DEMO-0996", "00996", "AMAZON_SHIPPING", S.ATS, 80, "SHIPPED", [[78, "PickupDone", "PICKED_UP", "Jaipur"], [60, "InTransit", "IN_TRANSIT", "Hyderabad"]], { lastFetch: ago(31), fetchError: "Synthetic: carrier tracking timed out 3 times" }),
  mk("DEMO-0997", "00997", "BLUEDART", S.BD_SURFACE_PREPAID, 5, "READY_TO_SHIP", [], { lastFetch: null, firstEdd: null }),
  mk("DEMO-0999", "00999", "AMAZON_SHIPPING", S.ATS, 150, "SHIPPED", [[148, "PickupDone", "PICKED_UP", "Jaipur"], [70, "Address incomplete - landmark missing", "NDR", "Chennai"], [46, "Address incomplete - landmark missing", "NDR", "Chennai"]], { revisedEdd: day(-24) }),
];

export const DEMO_SHIPPED_ORDERS: DemoOrder[] = [
  ["DEMO-0991", "L", "Kanpur", "Uttar Pradesh", "208001", "PREPAID"], ["DEMO-0992", "M", "Bhopal", "Madhya Pradesh", "462001", "PREPAID"],
  ["DEMO-0993", "N", "Surat", "Gujarat", "395003", "COD"], ["DEMO-0994", "O", "Raipur", "Chhattisgarh", "492001", "COD"],
  ["DEMO-0995", "P", "Patna", "Bihar", "800001", "PREPAID"], ["DEMO-0996", "Q", "Hyderabad", "Telangana", "500001", "PREPAID"],
  ["DEMO-0997", "R", "Jodhpur", "Rajasthan", "342001", "PREPAID"], ["DEMO-0998", "S", "Agra", "Uttar Pradesh", "282001", "COD"],
  ["DEMO-0999", "T", "Chennai", "Tamil Nadu", "600001", "COD"],
].map(([ref, n, city, state, pin, pay], i) => ({ ref: ref!, placedAt: ago(210 - i * 15).toISOString(), payment: pay as PaymentMode, intent: "STANDARD" as const,
  rawShippingMethod: "Standard Shipping", customer: c(n!, city!, state!, pin!), lines: [L(i % 2 ? "demo-sk-hi-1" : "demo-vs-hi-1", 1)], tags: ref === "DEMO-0998" ? ["cancelled"] : [] }));
export const DEMO_CANCELLED = new Set(["DEMO-0998"]);

export const DEMO_NDR: NdrCase[] = [
  { id: "ndr-0994", orderRef: "DEMO-0994", awb: "DEMO-DELHIVERY-900994", carrier: "DELHIVERY", reason: "CONTACT_ISSUE", rawCarrierText: "Consignee not reachable on phone", status: "ACTIVE", attempts: 1, lastAttemptAt: ago(20).toISOString(), openedAt: ago(20).toISOString(), dueAt: ago(-4).toISOString(), assignee: null, remarks: [], actions: [], synthetic: true },
  { id: "ndr-0999", orderRef: "DEMO-0999", awb: "DEMO-AMAZON_SHIPPING-900999", carrier: "AMAZON_SHIPPING", reason: "ADDRESS_ISSUE", rawCarrierText: "Address incomplete - landmark missing", status: "ACTIVE", attempts: 2, lastAttemptAt: ago(46).toISOString(), openedAt: ago(70).toISOString(), dueAt: ago(10).toISOString(), assignee: "demo-support", remarks: [{ at: ago(40).toISOString(), by: "demo-support", text: "Synthetic: landmark asked from customer on call" }], actions: [], synthetic: true },
  { id: "ndr-0995", orderRef: "DEMO-0995", awb: "DEMO-BLUEDART-900995", carrier: "BLUEDART", reason: "REFUSED", rawCarrierText: "Customer refused delivery", status: "CLOSED", attempts: 2, lastAttemptAt: ago(126).toISOString(), openedAt: ago(150).toISOString(), dueAt: null, assignee: "demo-support", remarks: [{ at: ago(110).toISOString(), by: "demo-support", text: "Synthetic: closed — courier initiated RTO" }], actions: [], synthetic: true },
];
