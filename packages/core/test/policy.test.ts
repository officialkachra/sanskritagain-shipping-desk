import { describe, expect, it } from "vitest";
import { allocate, matchPolicy, SEED_RULESET, DEMO_EXPRESS_DRAFT, SEED_SERVICE_IDS as S } from "../src";
import { ctx, order } from "./helpers";

describe("560064 override (approved, both payments)", () => {
  it("prepaid 560064 → Blue Dart Surface only, no fallback", () => {
    const r = allocate(order({ destPincode: "560064" }), ctx());
    expect(r.policyId).toBe("fwd-560064-bd-surface-only");
    expect(r.eligible.map(e => e.serviceId)).toEqual([S.BD_SURFACE_PREPAID]);
    expect(r.status).toBe("RECOMMENDED");
  });
  it("COD 560064 → Blue Dart Surface COD only, ahead of general COD rule", () => {
    const r = allocate(order({ destPincode: "560064", payment: "COD", codAmountPaise: 59900 }), ctx());
    expect(r.policyId).toBe("fwd-560064-bd-surface-only");
    expect(r.eligible.map(e => e.serviceId)).toEqual([S.BD_SURFACE_COD]);
    expect(r.status).toBe("RECOMMENDED");
  });
  it("BD Surface unserviceable at 560064 → NO_ELIGIBLE, never falls to ATS/Delhivery/Air", () => {
    const r = allocate(order({ destPincode: "560064" }), ctx({ serviceability: (sid) => ({ serviceable: !sid.startsWith("bluedart"), oda: false, source: "t", version: "1" }) }));
    expect(r.status).toBe("NO_ELIGIBLE"); expect(r.eligible).toHaveLength(0);
  });
  it("Express at 560064 → conflict shown, needs decision", () => {
    const r = allocate(order({ destPincode: "560064", intent: "EXPRESS" }), ctx());
    expect(r.status).toBe("NEEDS_POLICY_REVIEW"); expect(r.reviewReasons.join()).toMatch(/Conflict/);
  });
  it("other Bangalore pincodes get no extra BD-only rule; no 500089 rule exists", () => {
    expect(matchPolicy({ payment: "PREPAID", direction: "FORWARD", intent: "STANDARD", destPincode: "560066" }, SEED_RULESET)!.id).toBe("prepaid-forward-standard");
    expect(JSON.stringify(SEED_RULESET)).not.toContain("500089");
    expect(matchPolicy({ payment: "PREPAID", direction: "FORWARD", intent: "STANDARD", destPincode: "500089" }, SEED_RULESET)!.id).toBe("prepaid-forward-standard");
  });
});

describe("Express gate", () => {
  it("Express COD → NEEDS_POLICY_REVIEW", () => expect(allocate(order({ intent: "EXPRESS", payment: "COD", codAmountPaise: 100 }), ctx()).status).toBe("NEEDS_POLICY_REVIEW"));
  it("unknown method → review", () => expect(allocate(order({ intent: "UNKNOWN", rawShippingMethod: "Free Delivery Weekend" }), ctx()).status).toBe("REVIEW_REQUIRED"));
  it("demo draft express example is never selected even if present", () => {
    const c = ctx(); c.ruleSet = { ...SEED_RULESET, policies: [...SEED_RULESET.policies, DEMO_EXPRESS_DRAFT] };
    expect(allocate(order({ intent: "EXPRESS" }), c).status).toBe("NEEDS_POLICY_REVIEW");
  });
  it("an ACTIVE express policy (once decided) is used; only-Surface case shows exclusion honestly", () => {
    const c = ctx(); c.ruleSet = { ...SEED_RULESET, policies: [...SEED_RULESET.policies, { ...DEMO_EXPRESS_DRAFT, state: "ACTIVE" }] };
    const r = allocate(order({ intent: "EXPRESS" }), c);
    expect(r.status).toBe("RECOMMENDED"); expect(r.eligible[0]!.serviceId).toBe(S.BD_AIR_PREPAID);
    const r2 = allocate(order({ intent: "EXPRESS" }), { ...c, serviceability: (sid) => ({ serviceable: sid !== S.BD_AIR_PREPAID, oda: false, source: "t", version: "1" }) });
    expect(r2.status).toBe("NO_ELIGIBLE");
  });
  it("prepaid Air fallback does not authorize COD Air", () => {
    const r = allocate(order({ payment: "COD", codAmountPaise: 100 }), ctx({ serviceability: (sid) => ({ serviceable: sid === S.BD_AIR_PREPAID, oda: false, source: "t", version: "1" }) }));
    expect(r.eligible.map(e => e.serviceId)).not.toContain(S.BD_AIR_PREPAID);
  });
});
