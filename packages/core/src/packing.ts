import type { Dims } from "./types";

export interface BoxType extends Dims { code: string; tareG: number | null; legacyDefault: boolean }

/** Seven confirmed cm box types from current workflow. Tare unknown until measured. */
export const BOX_TYPES: readonly BoxType[] = Object.freeze([
  { code: "30x26x16_cm", lengthCm: 30, breadthCm: 26, heightCm: 16, tareG: null, legacyDefault: false },
  { code: "18x12x7_cm", lengthCm: 18, breadthCm: 12, heightCm: 7, tareG: null, legacyDefault: false },
  { code: "22x12x7_cm", lengthCm: 22, breadthCm: 12, heightCm: 7, tareG: null, legacyDefault: false },
  { code: "23x10x7_cm", lengthCm: 23, breadthCm: 10, heightCm: 7, tareG: null, legacyDefault: false },
  { code: "26x13x10_cm", lengthCm: 26, breadthCm: 13, heightCm: 10, tareG: null, legacyDefault: false },
  { code: "25x20x10_cm", lengthCm: 25, breadthCm: 20, heightCm: 10, tareG: null, legacyDefault: false },
  { code: "22x12x10_cm", lengthCm: 22, breadthCm: 12, heightCm: 10, tareG: null, legacyDefault: false },
]);

/** Legacy global default — kept unchanged, NOT a verified size for all products, never auto-assigned. */
export const LEGACY_DEFAULT_BOX: Readonly<BoxType> = Object.freeze({
  code: "LEGACY_DEFAULT_20x10x10_cm", lengthCm: 20, breadthCm: 10, heightCm: 10, tareG: null, legacyDefault: true,
});

export interface PackingReferenceRow {
  description: string; statedWeightG: number; boxCode: string;
  weightBasis: "UNCONFIRMED"; status: "INACTIVE_REFERENCE";
  note?: string; mapping: null; // explicit SKU/variant mapping required before activation
}

const r = (description: string, statedWeightG: number, boxCode: string, note?: string): PackingReferenceRow =>
  ({ description, statedWeightG, boxCode, weightBasis: "UNCONFIRMED", status: "INACTIVE_REFERENCE", mapping: null, ...(note ? { note } : {}) });

/** Owner-provided reference. Weights are whole-package stated values; packaging inclusion unconfirmed. */
export const PACKING_REFERENCE: readonly PackingReferenceRow[] = Object.freeze([
  r("Vishnu Sahasranama qty5", 3000, "30x26x16_cm"), r("Sundarkand qty5", 3000, "30x26x16_cm"),
  r("Bundle of 4", 350, "18x12x7_cm"), r("Bundle of 3", 250, "18x12x7_cm"),
  r("Hanuman Chalisa", 200, "18x12x7_cm"), r("Hanuman + Bajrang Baan", 200, "18x12x7_cm"),
  r("Vishnu Sahasranama qty1", 550, "22x12x7_cm"), r("Sundarkand qty1", 550, "23x10x7_cm"),
  r("Sundarkand + Lalita", 800, "26x13x10_cm"), r("Vishnu + Sundarkand", 1050, "26x13x10_cm"),
  r("Sundarkand + Lalita + VS", 1050, "25x20x10_cm"), r("Sundarkand qty2", 1030, "26x13x10_cm"),
  r("Vishnu qty2", 1093, "26x13x10_cm"),
  r("Lalita + VS + Hanuman", 900, "22x12x10_cm", "exact quantities unresolved"),
  r("Kannada Bhaktamar qty1", 150, "18x12x7_cm"), r("Ram Raksha 8x3 qty1", 300, "22x12x7_cm"),
  r("Bhaktamar 8x3 qty1", 250, "22x12x7_cm"), r("Bhaktamar qty1", 150, "18x12x7_cm"),
  r("Ganpati qty2", 200, "18x12x7_cm"), r("Durga qty2", 200, "18x12x7_cm"),
  r("Bajrang Baan qty2", 200, "18x12x7_cm"), r("Ram Raksha qty2", 200, "18x12x7_cm"),
  r("Shiv Tandav qty2", 200, "18x12x7_cm"), r("Shiv Rudra qty2", 200, "18x12x7_cm"),
  r("Kanakdhara qty2", 200, "18x12x7_cm"), r("Gujarati Hanuman Chalisa qty2", 200, "18x12x7_cm"),
]);

/** A validated rule: exact variant set+quantities → whole-package weight & box. Weight is for the WHOLE package. */
export interface BundlePackingRule {
  id: string; version: number;
  components: { variantId: string; qty: number }[];
  packageWeightG: number; boxCode: string;
  weightIncludesPackaging: boolean; // explicit, so tare is never added twice
  approvedBy: string; approvedAt: Date;
}

export interface OrderLineForPacking { variantId: string | null; qty: number }

export type PackingSuggestion =
  | { ok: true; ruleId: string; packageWeightG: number; boxCode: string; weightIncludesPackaging: boolean }
  | { ok: false; reason: "UNKNOWN_SKU" | "NO_VALIDATED_RULE" };

const key = (c: { variantId: string; qty: number }[]) =>
  [...c].sort((a, b) => a.variantId.localeCompare(b.variantId)).map(x => `${x.variantId}*${x.qty}`).join("|");

/** Exact-match only. No name matching, no multiplying bundle weights per item, no guessing. */
export function suggestPacking(lines: OrderLineForPacking[], rules: BundlePackingRule[]): PackingSuggestion {
  if (lines.some(l => !l.variantId)) return { ok: false, reason: "UNKNOWN_SKU" };
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.variantId!, (merged.get(l.variantId!) ?? 0) + l.qty);
  const k = key([...merged].map(([variantId, qty]) => ({ variantId, qty })));
  const rule = rules.find(r => key(r.components) === k);
  if (!rule) return { ok: false, reason: "NO_VALIDATED_RULE" };
  return { ok: true, ruleId: rule.id, packageWeightG: rule.packageWeightG, boxCode: rule.boxCode, weightIncludesPackaging: rule.weightIncludesPackaging };
}
