import "server-only";
import { DEMO_SERVICES, SEED_RULESET, SEED_SERVICE_IDS as S, type AllocationContext, type BundlePackingRule, type Quote, type ServiceabilityResult, type ShippingIntent, type PaymentMode } from "@shipdesk/core";

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
  { ref: "DEMO-1010", placedAt: "2026-10-08T05:50:00Z", payment: "PREPAID", intent: "STANDARD", rawShippingMethod: "Standard Shipping", customer: c("J", "Kolkata", "West Bengal", "700001"), lines: [L("demo-sk-hi-1", 1)], tags: [] },
];

/** Synthetic serviceability. Not real carrier data. */
export function demoServiceability(serviceId: string, pincode: string): ServiceabilityResult {
  const base = { source: "DEMO synthetic", version: "demo-2026-10" };
  if (pincode === "560064" && serviceId === S.BD_SURFACE_PREPAID) return { serviceable: false, oda: false, ...base };
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
