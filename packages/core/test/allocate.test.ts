import { describe, expect, it } from "vitest";
import { allocate, diffRecommendation, mapShippingIntent, advisoryScore, SEED_SCORING, SEED_SERVICE_IDS as S } from "../src";
import { ctx, order, NOW } from "./helpers";

describe("ordered allocation", () => {
  it("prepaid forward follows BD Surface > ATS > Delhivery > BD Air", () => {
    const r = allocate(order(), ctx());
    expect(r.status).toBe("RECOMMENDED");
    expect(r.eligible.map(e => e.serviceId)).toEqual([S.BD_SURFACE_PREPAID, S.ATS, S.DELHIVERY, S.BD_AIR_PREPAID]);
  });
  it("auto-falls back to Air last when others unserviceable", () => {
    const r = allocate(order(), ctx({ serviceability: (sid) => ({ serviceable: sid === S.BD_AIR_PREPAID, oda: false, source: "demo", version: "d1" }) }));
    expect(r.eligible[0]!.serviceId).toBe(S.BD_AIR_PREPAID); expect(r.excluded).toHaveLength(3);
    expect(r.status).toBe("RECOMMENDED");
  });
  it("COD never gets Air and COD policy is draft → review", () => {
    const r = allocate(order({ payment: "COD", codAmountPaise: 59900 }), ctx());
    expect(r.eligible.map(e => e.serviceId)).not.toContain(S.BD_AIR_PREPAID);
    expect(r.status).toBe("REVIEW_REQUIRED");
    expect(r.reviewReasons.join()).toMatch(/DRAFT_UNVERIFIED/);
  });
  it("prepaid-only BD Surface config excluded for COD even if listed", () => {
    const c = ctx(); c.ruleSet = { ...c.ruleSet, policies: [{ ...c.ruleSet.policies[1]!, orderedServiceIds: [S.BD_SURFACE_PREPAID, S.BD_AIR_PREPAID], state: "ACTIVE" }] };
    const r = allocate(order({ payment: "COD", codAmountPaise: 100 }), c);
    expect(r.status).toBe("NO_ELIGIBLE");
    expect(r.excluded.every(x => x.reasons.some(m => m.includes("COD not supported")))).toBe(true);
  });
  it("Express without policy → review, not silently FORWARD", () => {
    const r = allocate(order({ intent: "EXPRESS", rawShippingMethod: "Express Shipping" }), ctx());
    expect(r.status).toBe("REVIEW_REQUIRED"); expect(r.eligible).toHaveLength(0);
  });
  it("unknown SKU packing blocks via review", () =>
    expect(allocate(order({ packingValidated: false }), ctx()).status).toBe("REVIEW_REQUIRED"));
  it("missing quote is MISSING not zero, and forces review", () => {
    const c = ctx(); c.quotes.delete(S.BD_SURFACE_PREPAID);
    const r = allocate(order(), c);
    expect(r.eligible[0]!.quoteState).toBe("MISSING"); expect(r.status).toBe("REVIEW_REQUIRED");
  });
  it("expired quote forces review", () => {
    const c = ctx(); c.quotes.set(S.BD_SURFACE_PREPAID, { serviceId: S.BD_SURFACE_PREPAID, amountPaise: 5000, currency: "INR", expiresAt: new Date(NOW.getTime() - 1), source: "demo" });
    expect(allocate(order(), c).eligible[0]!.quoteState).toBe("EXPIRED");
  });
  it("scoped, expiring blacklist with reason; expired entries ignored", () => {
    const active = { id: "bl1", version: 1, reason: "review draft", scope: { serviceId: S.BD_SURFACE_PREPAID, pincode: "302021" }, expiresAt: null };
    const expired = { ...active, id: "bl2", scope: { carrier: "DELHIVERY" as const }, expiresAt: new Date(NOW.getTime() - 1000) };
    const r = allocate(order(), ctx({ blacklist: [active, expired] }));
    expect(r.excluded.map(x => x.serviceId)).toEqual([S.BD_SURFACE_PREPAID]);
    expect(r.eligible.map(e => e.serviceId)).toContain(S.DELHIVERY);
  });
  it("unknown serviceability is exclusion with explanation", () => {
    const r = allocate(order(), ctx({ serviceability: () => ({ serviceable: "UNKNOWN", oda: "UNKNOWN", source: "demo", version: "d1" }) }));
    expect(r.status).toBe("NO_ELIGIBLE"); expect(r.excluded[0]!.reasons[0]).toMatch(/unknown/);
  });
  it("rerun diff warns on default change", () => {
    const a = allocate(order(), ctx());
    const b = allocate(order(), ctx({ serviceability: (sid) => ({ serviceable: sid !== S.BD_SURFACE_PREPAID, oda: false, source: "d", version: "2" }) }));
    expect(diffRecommendation(a, b)[0]).toMatch(/Default service changed/);
  });
});

describe("shipping intent", () => {
  const maps = [{ match: "Express Shipping", matchOn: "title" as const, intent: "EXPRESS" as const }, { match: "Standard", matchOn: "title" as const, intent: "STANDARD" as const }];
  it("maps express and preserves raw", () => expect(mapShippingIntent([{ title: "Express Shipping", code: "EXP" }], maps)).toEqual({ intent: "EXPRESS", raw: "Express Shipping / EXP" }));
  it("unmapped → UNKNOWN", () => expect(mapShippingIntent([{ title: "Free Delivery", code: null }], maps).intent).toBe("UNKNOWN"));
  it("no lines → UNKNOWN", () => expect(mapShippingIntent([], maps).intent).toBe("UNKNOWN"));
});

describe("advisory scoring", () => {
  it("sparse cohorts → INSUFFICIENT_DATA", () => {
    const st = new Map([["a", { serviceId: "a", matureShipments: 20, completedRto: 1, delivered: 19 }], ["b", { serviceId: "b", matureShipments: 500, completedRto: 50, delivered: 450 }]]);
    expect(advisoryScore(["a", "b"], st, new Map([["a", 5000], ["b", 6000]]), SEED_SCORING).status).toBe("INSUFFICIENT_DATA");
  });
  it("missing cost → INSUFFICIENT_DATA", () => {
    const st = new Map([["a", { serviceId: "a", matureShipments: 500, completedRto: 30, delivered: 470 }], ["b", { serviceId: "b", matureShipments: 500, completedRto: 80, delivered: 420 }]]);
    expect(advisoryScore(["a", "b"], st, new Map([["a", 5000], ["b", null]]), SEED_SCORING).status).toBe("INSUFFICIENT_DATA");
  });
});
