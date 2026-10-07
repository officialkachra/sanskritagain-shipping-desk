import type { AllocationInput, BlacklistEntry, Quote, ServiceDef, ServiceabilityResult } from "../types";
import type { RuleSetVersion } from "./rules";

export interface AllocationContext {
  now: Date;
  ruleSet: RuleSetVersion;
  services: Map<string, ServiceDef>;
  serviceability: (serviceId: string, pincode: string) => ServiceabilityResult;
  quotes: Map<string, Quote>;
  blacklist: BlacklistEntry[];
}

export interface RankedService { serviceId: string; priority: number; quote: Quote | null; quoteState: "VALID" | "EXPIRED" | "MISSING" }
export interface Exclusion { serviceId: string; priority: number; reasons: string[] }

export interface RecommendationSnapshot {
  orderRef: string;
  ruleSetVersion: string;
  policyId: string | null;
  status: "RECOMMENDED" | "REVIEW_REQUIRED" | "NO_ELIGIBLE";
  reviewReasons: string[];
  eligible: RankedService[];
  excluded: Exclusion[];
  trace: string[];
  createdAt: Date;
}

/** Pure, deterministic. Never books, never creates an AWB. */
export function allocate(input: AllocationInput, ctx: AllocationContext): RecommendationSnapshot {
  const trace: string[] = [];
  const reviewReasons: string[] = [];
  const base = { orderRef: input.orderRef, ruleSetVersion: ctx.ruleSet.version, createdAt: ctx.now };

  if (input.intent === "UNKNOWN") reviewReasons.push(`Shipping intent unknown (raw method: ${input.rawShippingMethod ?? "none"})`);
  if (!input.packingValidated) reviewReasons.push("Packing not validated (unknown SKU / unmapped variant / unvalidated bundle) — live booking blocked");
  if (input.packedWeightG === null) reviewReasons.push("Actual packed weight not recorded");
  if (!/^[1-9]\d{5}$/.test(input.destPincode)) reviewReasons.push(`Invalid destination pincode '${input.destPincode}'`);
  if (input.payment === "COD" && input.codAmountPaise <= 0) reviewReasons.push("COD order with non-positive collection amount");

  const policy = ctx.ruleSet.policies.find(p => p.state !== "RETIRED" &&
    p.match.payment === input.payment && p.match.direction === input.direction && p.match.intent === input.intent);
  if (!policy) {
    trace.push(`No policy for ${input.payment}/${input.direction}/${input.intent}`);
    reviewReasons.push(`No allocation policy for ${input.payment} ${input.direction} ${input.intent}`);
    return { ...base, policyId: null, status: "REVIEW_REQUIRED", reviewReasons, eligible: [], excluded: [], trace };
  }
  trace.push(`Policy ${policy.id} (${policy.state}) order: ${policy.orderedServiceIds.join(" > ")}`);
  if (policy.state === "DRAFT_UNVERIFIED") reviewReasons.push(`Policy ${policy.id} is DRAFT_UNVERIFIED — needs verified priority export before activation`);

  const eligible: RankedService[] = [];
  const excluded: Exclusion[] = [];
  policy.orderedServiceIds.forEach((sid, idx) => {
    const priority = idx + 1;
    const reasons: string[] = [];
    const svc = ctx.services.get(sid);
    if (!svc) { excluded.push({ serviceId: sid, priority, reasons: ["Service not configured"] }); return; }
    if (!svc.enabled) reasons.push("Service/account disabled");
    if (!svc.payments.includes(input.payment)) reasons.push(`${input.payment} not supported by this service config`);
    if (!svc.directions.includes(input.direction)) reasons.push(`${input.direction} not supported`);
    if (svc.maxWeightG !== null && input.packedWeightG !== null && input.packedWeightG > svc.maxWeightG) reasons.push(`Weight ${input.packedWeightG}g > max ${svc.maxWeightG}g`);
    const sv = ctx.serviceability(sid, input.destPincode);
    if (sv.serviceable === false) reasons.push(`Pincode ${input.destPincode} not serviceable (${sv.source} ${sv.version})`);
    if (sv.serviceable === "UNKNOWN") reasons.push(`Serviceability unknown for ${input.destPincode}`);
    for (const b of ctx.blacklist) {
      if (b.expiresAt && b.expiresAt <= ctx.now) continue;
      const hitSvc = !b.scope.serviceId || b.scope.serviceId === sid;
      const hitCar = !b.scope.carrier || b.scope.carrier === svc.carrier;
      const hitPin = !b.scope.pincode || b.scope.pincode === input.destPincode;
      if (hitSvc && hitCar && hitPin) reasons.push(`Blacklist ${b.id} v${b.version}: ${b.reason}`);
    }
    if (reasons.length) { excluded.push({ serviceId: sid, priority, reasons }); trace.push(`P${priority} ${sid} EXCLUDED: ${reasons.join("; ")}`); return; }
    const q = ctx.quotes.get(sid) ?? null;
    const quoteState = !q || q.amountPaise === null ? "MISSING" : q.expiresAt <= ctx.now ? "EXPIRED" : "VALID";
    eligible.push({ serviceId: sid, priority, quote: q, quoteState });
    trace.push(`P${priority} ${sid} ELIGIBLE (quote ${quoteState}${sv.oda === true ? ", ODA" : ""})`);
  });

  if (!policy.autoFallback && eligible.length && eligible[0]!.priority !== 1) reviewReasons.push("P1 unavailable and auto-fallback disabled");
  if (eligible[0] && eligible[0].quoteState !== "VALID") reviewReasons.push(`Top service quote ${eligible[0].quoteState} — refresh before approval`);

  const status = eligible.length === 0 ? "NO_ELIGIBLE" : reviewReasons.length ? "REVIEW_REQUIRED" : "RECOMMENDED";
  return { ...base, policyId: policy.id, status, reviewReasons, eligible, excluded, trace };
}

/** Rerun comparison: warns when default service or cost changed. Does not book. */
export function diffRecommendation(prev: RecommendationSnapshot, next: RecommendationSnapshot): string[] {
  const w: string[] = [];
  const a = prev.eligible[0], b = next.eligible[0];
  if (a?.serviceId !== b?.serviceId) w.push(`Default service changed: ${a?.serviceId ?? "none"} → ${b?.serviceId ?? "none"}`);
  if (a && b && a.serviceId === b.serviceId && a.quote?.amountPaise !== b.quote?.amountPaise)
    w.push(`Quote changed: ${a.quote?.amountPaise ?? "unknown"} → ${b.quote?.amountPaise ?? "unknown"} paise`);
  if (prev.ruleSetVersion !== next.ruleSetVersion) w.push(`Rule set changed: ${prev.ruleSetVersion} → ${next.ruleSetVersion}`);
  return w;
}
