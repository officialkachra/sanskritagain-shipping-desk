import { describe, expect, it } from "vitest";
import { BOX_TYPES, LEGACY_DEFAULT_BOX, PACKING_REFERENCE, suggestPacking, estimateBillable, DEMO_SERVICES } from "../src";

describe("box types", () => {
  it("seeds exactly the 7 confirmed sizes", () => {
    expect(BOX_TYPES.map(b => `${b.lengthCm}x${b.breadthCm}x${b.heightCm}`)).toEqual(["30x26x16","18x12x7","22x12x7","23x10x7","26x13x10","25x20x10","22x12x10"]);
    expect(BOX_TYPES.every(b => b.tareG === null)).toBe(true);
  });
  it("keeps legacy default 20x10x10 unchanged and flagged", () => {
    expect(LEGACY_DEFAULT_BOX).toMatchObject({ lengthCm: 20, breadthCm: 10, heightCm: 10, legacyDefault: true });
  });
  it("reference rows are inactive, unconfirmed, unmapped, original precision", () => {
    expect(PACKING_REFERENCE).toHaveLength(26);
    expect(PACKING_REFERENCE.every(r => r.weightBasis === "UNCONFIRMED" && r.status === "INACTIVE_REFERENCE" && r.mapping === null)).toBe(true);
    expect(PACKING_REFERENCE.find(r => r.description === "Vishnu qty2")!.statedWeightG).toBe(1093);
  });
});

describe("packing suggestion", () => {
  const rules = [{ id: "r1", version: 1, components: [{ variantId: "hc", qty: 1 }, { variantId: "bb", qty: 1 }], packageWeightG: 200, boxCode: "18x12x7_cm", weightIncludesPackaging: true, approvedBy: "admin", approvedAt: new Date() }];
  it("unknown SKU blocks", () => expect(suggestPacking([{ variantId: null, qty: 1 }], rules)).toEqual({ ok: false, reason: "UNKNOWN_SKU" }));
  it("bundle weight is whole-package, not multiplied", () => {
    const s = suggestPacking([{ variantId: "bb", qty: 1 }, { variantId: "hc", qty: 1 }], rules);
    expect(s).toMatchObject({ ok: true, packageWeightG: 200 });
  });
  it("different quantities do not match by name/partial", () =>
    expect(suggestPacking([{ variantId: "hc", qty: 2 }, { variantId: "bb", qty: 1 }], rules)).toEqual({ ok: false, reason: "NO_VALIDATED_RULE" }));
});

describe("billable weight", () => {
  const svc = { ...DEMO_SERVICES[0]!, volumetricDivisor: 5000, slabG: 500 };
  it("uses contract divisor and slab, never clamps actual", () => {
    const e = estimateBillable(520, { lengthCm: 22, breadthCm: 12, heightCm: 7 }, svc);
    expect(e.actualG).toBe(520); expect(e.volumetricG).toBe(370); expect(e.billableG).toBe(1000);
    expect(e.warnings.some(w => w.includes("slab boundary"))).toBe(true);
  });
  it("volumetric dominates for big light box", () => {
    const e = estimateBillable(1000, { lengthCm: 30, breadthCm: 26, heightCm: 16 }, svc);
    expect(e.volumetricG).toBe(2496); expect(e.billableG).toBe(2500);
  });
  it("unknown contract → billable unknown, not guessed", () => {
    expect(estimateBillable(550, { lengthCm: 22, breadthCm: 12, heightCm: 7 }, DEMO_SERVICES[0]!).billableG).toBeNull();
  });
  it("rejects missing/zero measured weight", () => expect(() => estimateBillable(0, { lengthCm: 1, breadthCm: 1, heightCm: 1 }, svc)).toThrow());
});
