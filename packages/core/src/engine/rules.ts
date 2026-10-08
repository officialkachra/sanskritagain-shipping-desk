import type { Direction, PaymentMode, ShippingIntent } from "../types";

/** ACTIVE: confirmed business policy (still subject to adapter readiness).
 *  UNVERIFIED_MAPPING: membership observed, exact account/service mapping or order not verified → review.
 *  DRAFT_EXAMPLE: illustration only (demo); never selected. RETIRED: history only. */
export type PolicyState = "ACTIVE" | "UNVERIFIED_MAPPING" | "DRAFT_EXAMPLE" | "RETIRED";

export interface AllocationPolicy {
  id: string;
  name: string;
  priority: number;                 // lower = evaluated first
  state: PolicyState;
  match: { payments: PaymentMode[]; direction: Direction; intents: ShippingIntent[] };
  scope?: { destPincodes?: string[] };
  orderedServiceIds: string[];      // P1..Pn; payment eligibility filters per order
  exclusive: boolean;               // true = only these services; never fall through to other policies
  provenance: string;
  history?: { at: string; note: string }[];
}

export interface RuleSetVersion { version: string; createdAt: Date; createdBy: string; note: string; policies: AllocationPolicy[] }

export const SEED_SERVICE_IDS = {
  BD_SURFACE_PREPAID: "bluedart.surface.prepaid",
  BD_SURFACE_COD: "bluedart.surface.cod",
  BD_AIR_PREPAID: "bluedart.air.prepaid",
  ATS: "amazon.ats.standard",
  DELHIVERY: "delhivery.surface.standard",
} as const;
const S = SEED_SERVICE_IDS;

export const SEED_RULESET: RuleSetVersion = {
  version: "v2-migration-seed",
  createdAt: new Date("2026-10-08T00:00:00Z"),
  createdBy: "seed",
  note: "Owner-confirmed policies migrated from ClickPost. A confirmed policy does not make any courier adapter ready for live use.",
  policies: [
    {
      id: "fwd-560064-bd-surface-only", name: "560064 → Blue Dart Surface only", priority: 1, state: "ACTIVE",
      match: { payments: ["PREPAID", "COD"], direction: "FORWARD", intents: ["STANDARD", "EXPRESS"] },
      scope: { destPincodes: ["560064"] },
      orderedServiceIds: [S.BD_SURFACE_PREPAID, S.BD_SURFACE_COD], exclusive: true,
      provenance: "Approved for COD and prepaid; saved and tested in ClickPost as priority #1 ahead of general rules.",
      history: [{ at: "2026-10-08", note: "Earlier V2 seed called this a review draft; superseded by owner approval." }],
    },
    {
      id: "prepaid-forward-standard", name: "Prepaid forward", priority: 10, state: "ACTIVE",
      match: { payments: ["PREPAID"], direction: "FORWARD", intents: ["STANDARD"] },
      orderedServiceIds: [S.BD_SURFACE_PREPAID, S.ATS, S.DELHIVERY, S.BD_AIR_PREPAID], exclusive: false,
      provenance: "Owner-stated order; Blue Dart Air approved as last automatic fallback for prepaid only.",
      history: [{ at: "earlier", note: "Air was customer-request-only before; widened to last-priority fallback (prepaid)." }],
    },
    {
      id: "cod-forward-standard", name: "COD forward", priority: 11, state: "UNVERIFIED_MAPPING",
      match: { payments: ["COD"], direction: "FORWARD", intents: ["STANDARD"] },
      orderedServiceIds: [S.ATS, S.DELHIVERY, S.BD_SURFACE_COD], exclusive: false,
      provenance: "Observed in ClickPost: ATS, Delhivery, Blue Dart Surface. Exact account/service mapping not verified. No COD Air.",
    },
  ],
};

/** DEMO illustration only — shows what an Express policy would look like. Never selected for allocation. */
export const DEMO_EXPRESS_DRAFT: AllocationPolicy = {
  id: "express-prepaid-draft-example", name: "Express prepaid (draft example)", priority: 5, state: "DRAFT_EXAMPLE",
  match: { payments: ["PREPAID"], direction: "FORWARD", intents: ["EXPRESS"] },
  orderedServiceIds: [S.BD_AIR_PREPAID], exclusive: true,
  provenance: "Example only. Undecided: Express prepaid service, Express COD service, whether Surface/ATS fallback is allowed, max extra cost.",
};

export const OPEN_EXPRESS_DECISIONS = [
  "Which service(s) for Express prepaid",
  "Which service(s) for Express COD (if any)",
  "Whether ordinary Surface/ATS fallback is acceptable for Express",
  "Maximum extra cost allowed for Express",
] as const;
