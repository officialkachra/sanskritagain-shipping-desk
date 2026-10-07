import type { Dims, ServiceDef } from "./types";

export interface BillableEstimate {
  actualG: number;
  volumetricG: number | null;
  billableG: number | null;     // null when contract divisor/slab unknown
  warnings: string[];
}

/** Per-service, contract-driven. Never clamps or rewrites actual weight. */
export function estimateBillable(actualG: number, box: Dims, svc: ServiceDef): BillableEstimate {
  if (!Number.isFinite(actualG) || actualG <= 0) throw new Error("actual packed weight must be a positive measured value");
  const warnings: string[] = [];
  let volumetricG: number | null = null;
  if (svc.volumetricDivisor) {
    // divisor convention: cm^3 / divisor = kg
    volumetricG = Math.ceil((box.lengthCm * box.breadthCm * box.heightCm) / svc.volumetricDivisor * 1000);
    if (volumetricG > actualG) warnings.push(`Volumetric ${volumetricG}g exceeds actual ${actualG}g`);
  } else warnings.push("Volumetric divisor unknown for this service (contract not verified)");
  let billableG: number | null = null;
  if (volumetricG !== null && svc.slabG) {
    const base = Math.max(actualG, volumetricG);
    billableG = Math.ceil(base / svc.slabG) * svc.slabG;
    const prevSlab = billableG - svc.slabG;
    if (base - prevSlab <= Math.min(50, svc.slabG / 10) && prevSlab > 0) warnings.push(`Just over ${prevSlab}g slab boundary`);
  } else if (!svc.slabG) warnings.push("Billing slab unknown for this service (contract not verified)");
  return { actualG, volumetricG, billableG, warnings };
}
