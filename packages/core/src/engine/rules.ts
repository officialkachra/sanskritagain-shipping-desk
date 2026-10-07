import type { Direction, PaymentMode, ShippingIntent } from "../types";

export type PolicyState = "ACTIVE" | "DRAFT_UNVERIFIED" | "RETIRED";

export interface AllocationPolicy {
  id: string;
  name: string;
  state: PolicyState;
  match: { payment: PaymentMode; direction: Direction; intent: ShippingIntent };
  orderedServiceIds: string[];   // P1..Pn
  autoFallback: boolean;         // owner-approved automatic fallback down the list
  provenance: string;
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

/** Migration seed. COD order is NOT assumed to match prepaid — kept DRAFT until exact export is verified. */
export const SEED_RULESET: RuleSetVersion = {
  version: "v1-migration-seed",
  createdAt: new Date("2026-10-08T00:00:00Z"),
  createdBy: "seed",
  note: "Seeded from owner-stated latest ClickPost preferences. Requires verification before LIVE use.",
  policies: [
    {
      id: "prepaid-forward-standard", name: "Prepaid Forward", state: "ACTIVE",
      match: { payment: "PREPAID", direction: "FORWARD", intent: "STANDARD" },
      orderedServiceIds: [S.BD_SURFACE_PREPAID, S.ATS, S.DELHIVERY, S.BD_AIR_PREPAID],
      autoFallback: true,
      provenance: "Owner-stated latest order; Air accepted as last-priority automatic fallback. Earlier customer-request-only Air preference retained in history.",
    },
    {
      id: "cod-forward-standard", name: "COD Forward", state: "DRAFT_UNVERIFIED",
      match: { payment: "COD", direction: "FORWARD", intent: "STANDARD" },
      orderedServiceIds: [S.ATS, S.DELHIVERY, S.BD_SURFACE_COD],
      autoFallback: true,
      provenance: "Membership known (ATS, Delhivery, BD Surface); exact priority order NOT verified. No COD Air.",
    },
    // No EXPRESS policies seeded: Express (and COD Express) is a separate support decision → review.
  ],
};
