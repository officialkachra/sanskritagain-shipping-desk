import type { AllocationInput, BlacklistEntry, Quote, ServiceDef, ServiceabilityResult } from "../types";
import type { AllocationPolicy, RuleSetVersion } from "./rules";

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
export type RecStatus = "RECOMMENDED" | "REVIEW_REQUIRED" | "NEEDS_POLICY_REVIEW" | "NO_ELIGIBLE";

export interface RecommendationSnapshot {
  orderRef: string;
  ruleSetVersion: string;
  policyId: string | null;
  status: RecStatus;
  reviewReasons: string[];
  eligible: RankedService[];
  excluded: Exclusion[];
  trace: string[];
  createdAt: Date;
}

const selectable = (p: AllocationPolicy) => p.state === "ACTIVE" || p.state === "UNVERIFIED_MAPPING";

export function matchPolicy(input: Pick<AllocationInput, "payment" | "direction" | "intent" | "destPincode">, rs: RuleSetVersion): AllocationPolicy | null {
  return [...rs.policies].filter(selectable).sort((a, b) => a.priority - b.priority).find(p =>
    p.match.payments.includes(input.payment) && p.match.direction === input.direction && p.match.intents.includes(input.intent) &&
    (!p.scope?.destPincodes || p.scope.destPincodes.includes(input.destPincode))) ?? null;
}

/** Pure, deterministic. Order: eligibility → scoped constraints → ordered priorities. Never books. */
export function allocate(input: AllocationInput, ctx: AllocationContext): RecommendationSnapshot {
  const trace: string[] = [];
  const reviewReasons: string[] = [];
  const base = { orderRef: input.orderRef, ruleSetVersion: ctx.ruleSet.version, createdAt: ctx.now };

  if (input.intent === "UNKNOWN") reviewReasons.push(`Shipping method not mapped (raw: ${input.rawShippingMethod ?? "none"})`);
  if (!input.packingValidated) reviewReasons.push("Packing not validated (unknown SKU / unmapped variant / unvalidated bundle) — live booking blocked");
  if (input.packedWeightG === null) reviewReasons.push("Actual packed weight not recorded");
  if (!/^[1-9]\d{5}$/.test(input.destPincode)) reviewReasons.push(`Invalid destination pincode '${input.destPincode}'`);
  if (input.payment === "COD" && input.codAmountPaise <= 0) reviewReasons.push("COD order with non-positive collection amount");

  const policy = matchPolicy(input, ctx.ruleSet);
  const isExpress = input.intent === "EXPRESS";
  const expressPolicy = policy && policy.match.intents.length === 1 && policy.match.intents[0] === "EXPRESS";
  let needsPolicy = false;
  if (isExpress && !expressPolicy) {
    needsPolicy = true;
    reviewReasons.push("Express policy not decided — cannot book through a guessed policy");
    if (policy?.scope?.destPincodes) reviewReasons.push(`Conflict: ${policy.name} applies to this pincode, but Express service is undecided. Needs an owner decision.`);
  }
  if (!policy) {
    trace.push(`No policy for ${input.payment}/${input.direction}/${input.intent}/${input.destPincode}`);
    if (!needsPolicy) reviewReasons.push(`No allocation policy for ${input.payment} ${input.direction} ${input.intent}`);
    return { ...base, policyId: null, status: needsPolicy ? "NEEDS_POLICY_REVIEW" : "REVIEW_REQUIRED", reviewReasons, eligible: [], excluded: [], trace };
  }
  trace.push(`Policy ${policy.id} (P${policy.priority}, ${policy.state}${policy.exclusive ? ", exclusive" : ""}): ${policy.orderedServiceIds.join(" > ")}`);
  if (policy.state === "UNVERIFIED_MAPPING") reviewReasons.push(`Policy ${policy.id}: account/service mapping not verified — review before booking`);

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
      const hit = (!b.scope.serviceId || b.scope.serviceId === sid) && (!b.scope.carrier || b.scope.carrier === svc.carrier) && (!b.scope.pincode || b.scope.pincode === input.destPincode);
      if (hit) reasons.push(`Blacklist ${b.id} v${b.version}: ${b.reason}`);
    }
    if (reasons.length) { excluded.push({ serviceId: sid, priority, reasons }); trace.push(`P${priority} ${sid} EXCLUDED: ${reasons.join("; ")}`); return; }
    const q = ctx.quotes.get(sid) ?? null;
    const quoteState = !q || q.amountPaise === null ? "MISSING" : q.expiresAt <= ctx.now ? "EXPIRED" : "VALID";
    eligible.push({ serviceId: sid, priority, quote: q, quoteState });
    trace.push(`P${priority} ${sid} ELIGIBLE (quote ${quoteState}${sv.oda === true ? ", ODA" : ""})`);
  });

  if (eligible.length === 0 && policy.exclusive) trace.push("Exclusive policy: no fallback to other rules");
  if (eligible[0] && eligible[0].quoteState !== "VALID") reviewReasons.push(`Top service quote ${eligible[0].quoteState.toLowerCase()} — refresh before approval`);

  const status: RecStatus = needsPolicy ? "NEEDS_POLICY_REVIEW" : eligible.length === 0 ? "NO_ELIGIBLE" : reviewReasons.length ? "REVIEW_REQUIRED" : "RECOMMENDED";
  return { ...base, policyId: policy.id, status, reviewReasons, eligible: needsPolicy ? [] : eligible, excluded, trace };
}

export function diffRecommendation(prev: RecommendationSnapshot, next: RecommendationSnapshot): string[] {
  const w: string[] = [];
  const a = prev.eligible[0], b = next.eligible[0];
  if (a?.serviceId !== b?.serviceId) w.push(`Default service changed: ${a?.serviceId ?? "none"} → ${b?.serviceId ?? "none"}`);
  if (a && b && a.serviceId === b.serviceId && a.quote?.amountPaise !== b.quote?.amountPaise)
    w.push(`Quote changed: ${a.quote?.amountPaise ?? "unknown"} → ${b.quote?.amountPaise ?? "unknown"} paise`);
  if (prev.status !== next.status) w.push(`Status changed: ${prev.status} → ${next.status}`);
  if (prev.ruleSetVersion !== next.ruleSetVersion) w.push(`Rule set changed: ${prev.ruleSetVersion} → ${next.ruleSetVersion}`);
  return w;
}
