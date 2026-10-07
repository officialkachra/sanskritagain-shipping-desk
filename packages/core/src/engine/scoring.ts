/** Transparent advisory score. Documented model, NOT a reproduction of ClickPost PBA.
 *  It never reorders the ordered list; it only annotates alternatives when data are adequate. */
export interface CohortStats { serviceId: string; matureShipments: number; completedRto: number; delivered: number }
export interface ScoringConfig { version: string; rtoWeight: number; costWeight: number; minMature: number; priorStrength: number; priorRtoRate: number }

export const SEED_SCORING: ScoringConfig = { version: "score-v0-seed-RTO80-Pricing20", rtoWeight: 0.8, costWeight: 0.2, minMature: 200, priorStrength: 50, priorRtoRate: 0.12 };

export type AdvisoryScore =
  | { status: "INSUFFICIENT_DATA"; reasons: string[] }
  | { status: "SCORED"; version: string; rows: { serviceId: string; smoothedRto: number; normCost: number; score: number; n: number }[] };

export function smoothedRto(s: CohortStats, cfg: ScoringConfig): number {
  const closed = s.delivered + s.completedRto; // pending/open are excluded (right-censored)
  return (s.completedRto + cfg.priorStrength * cfg.priorRtoRate) / (closed + cfg.priorStrength);
}

export function advisoryScore(serviceIds: string[], stats: Map<string, CohortStats>, costs: Map<string, number | null>, cfg: ScoringConfig): AdvisoryScore {
  const reasons: string[] = [];
  for (const id of serviceIds) {
    const st = stats.get(id);
    if (!st || st.matureShipments < cfg.minMature) reasons.push(`${id}: mature sample ${st?.matureShipments ?? 0} < ${cfg.minMature}`);
    const c = costs.get(id);
    if (c === null || c === undefined) reasons.push(`${id}: no quote (unknown cost, not zero)`);
  }
  if (serviceIds.length < 2) reasons.push("fewer than 2 eligible services");
  if (reasons.length) return { status: "INSUFFICIENT_DATA", reasons };
  const cs = serviceIds.map(id => costs.get(id) as number);
  const min = Math.min(...cs), max = Math.max(...cs);
  const rows = serviceIds.map((id, i) => {
    const r = smoothedRto(stats.get(id)!, cfg);
    const normCost = max === min ? 0 : (cs[i]! - min) / (max - min);
    return { serviceId: id, smoothedRto: r, normCost, score: cfg.rtoWeight * r + cfg.costWeight * normCost, n: stats.get(id)!.matureShipments };
  }).sort((a, b) => a.score - b.score);
  return { status: "SCORED", version: cfg.version, rows };
}
