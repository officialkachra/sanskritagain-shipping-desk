export type Outcome = "DELIVERED" | "COMPLETED_RTO" | "PENDING_RTO" | "OPEN" | "CANCELLED" | "LOST";
export interface ShipmentOutcome { cohort: string; outcome: Outcome; pickedUpAt: Date | null; deliveredAt: Date | null }

export interface CohortReport {
  cohort: string; total: number; counts: Record<Outcome, number>;
  closedRto: number | null; mature: boolean; tatMedianH: number | null; tatP90H: number | null; tatSample: number;
}

const pct = (sorted: number[], p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]! : null;

/** closedRTO = completedRTO / (delivered + completedRTO). Open/pending are right-censored, not successes. */
export function cohortReport(rows: ShipmentOutcome[], minMature: number): CohortReport[] {
  const by = new Map<string, ShipmentOutcome[]>();
  for (const r of rows) by.set(r.cohort, [...(by.get(r.cohort) ?? []), r]);
  return [...by].map(([cohort, rs]) => {
    const counts = { DELIVERED: 0, COMPLETED_RTO: 0, PENDING_RTO: 0, OPEN: 0, CANCELLED: 0, LOST: 0 } as Record<Outcome, number>;
    rs.forEach(r => counts[r.outcome]++);
    const closed = counts.DELIVERED + counts.COMPLETED_RTO;
    const tats = rs.filter(r => r.outcome === "DELIVERED" && r.pickedUpAt && r.deliveredAt && r.deliveredAt > r.pickedUpAt)
      .map(r => (r.deliveredAt!.getTime() - r.pickedUpAt!.getTime()) / 36e5).sort((a, b) => a - b);
    return { cohort, total: rs.length, counts, closedRto: closed ? counts.COMPLETED_RTO / closed : null, mature: closed >= minMature,
      tatMedianH: pct(tats, 0.5), tatP90H: pct(tats, 0.9), tatSample: tats.length };
  });
}
