import type { ServiceDef } from "./types";
import { SEED_SERVICE_IDS as S } from "./engine/rules";

/** DEMO service configs. Payment/direction support reflects owner-stated current routing only;
 *  weight limits, divisors and slabs are UNKNOWN (null) until verified rate contracts are loaded. */
export const DEMO_SERVICES: ServiceDef[] = [
  { id: S.BD_SURFACE_PREPAID, carrier: "BLUEDART", accountId: "bd-surface-acct", label: "Blue Dart Surface (Prepaid)", transport: "SURFACE", payments: ["PREPAID"], directions: ["FORWARD"], maxWeightG: null, volumetricDivisor: null, slabG: null, enabled: true },
  { id: S.BD_SURFACE_COD, carrier: "BLUEDART", accountId: "bd-surface-cod-acct", label: "Blue Dart Surface (COD)", transport: "SURFACE", payments: ["COD"], directions: ["FORWARD"], maxWeightG: null, volumetricDivisor: null, slabG: null, enabled: true },
  { id: S.BD_AIR_PREPAID, carrier: "BLUEDART", accountId: "bd-air-acct", label: "Blue Dart Air (Prepaid only)", transport: "AIR", payments: ["PREPAID"], directions: ["FORWARD"], maxWeightG: null, volumetricDivisor: null, slabG: null, enabled: true },
  { id: S.ATS, carrier: "AMAZON_SHIPPING", accountId: "ats-acct", label: "ATS / Amazon Shipping", transport: "UNKNOWN", payments: ["PREPAID", "COD"], directions: ["FORWARD"], maxWeightG: null, volumetricDivisor: null, slabG: null, enabled: true },
  { id: S.DELHIVERY, carrier: "DELHIVERY", accountId: "dlv-acct", label: "Delhivery", transport: "SURFACE", payments: ["PREPAID", "COD"], directions: ["FORWARD"], maxWeightG: null, volumetricDivisor: null, slabG: null, enabled: true },
];
