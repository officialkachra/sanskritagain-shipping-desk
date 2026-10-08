export interface ManifestCandidate { awb: string; orderRef: string; carrier: string; warehouseId: string; bookedAt: Date; labelPrinted: boolean; packedScanned: boolean }
export interface ManifestBatch {
  key: string; warehouseId: string; carrier: string; dispatchDate: string; awbs: string[];
  missingLabels: string[]; notScanned: string[];
  states: { localListPrepared: boolean; carrierManifest: "NOT_SUPPORTED" | "NOT_GENERATED" | "GENERATED"; pickup: "NOT_REQUESTED" | "REQUESTED" | "CONFIRMED"; handover: "PENDING" | "HANDED_OVER" };
  kind: "LOCAL_HANDOVER_LIST"; // not an official courier manifest
}

const istDate = (d: Date) => new Date(d.getTime() + 330 * 60e3).toISOString().slice(0, 10);

/** Group confirmed AWBs by warehouse + carrier + IST dispatch date; reconcile labels/scans. */
export function buildManifests(rows: ManifestCandidate[], carrierSupportsManifest: (carrier: string) => boolean): ManifestBatch[] {
  const by = new Map<string, ManifestCandidate[]>();
  for (const r of rows) { const k = `${r.warehouseId}|${r.carrier}|${istDate(r.bookedAt)}`; by.set(k, [...(by.get(k) ?? []), r]); }
  return [...by].map(([key, rs]) => {
    const [warehouseId, carrier, dispatchDate] = key.split("|") as [string, string, string];
    return { key, warehouseId, carrier, dispatchDate, awbs: rs.map(r => r.awb),
      missingLabels: rs.filter(r => !r.labelPrinted).map(r => r.awb), notScanned: rs.filter(r => !r.packedScanned).map(r => r.awb),
      states: { localListPrepared: true, carrierManifest: carrierSupportsManifest(carrier) ? "NOT_GENERATED" : "NOT_SUPPORTED", pickup: "NOT_REQUESTED", handover: "PENDING" },
      kind: "LOCAL_HANDOVER_LIST" as const };
  });
}
