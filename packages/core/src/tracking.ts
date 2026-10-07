export type CanonicalStatus = "BOOKED" | "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "NDR" | "RTO_INITIATED" | "RTO_IN_TRANSIT" | "RTO_DELIVERED" | "CANCELLED" | "LOST" | "UNMAPPED";
export const TERMINAL: ReadonlySet<CanonicalStatus> = new Set(["DELIVERED", "RTO_DELIVERED", "CANCELLED", "LOST"]);

export interface TrackingEvent {
  carrier: string; awb: string; providerEventId: string | null;
  providerStatus: string; canonical: CanonicalStatus;
  occurredAt: Date; sourceTz: string; location: string | null; receivedAt: Date;
}

const ek = (e: TrackingEvent) => `${e.carrier}|${e.awb}|${e.providerEventId ?? `${e.providerStatus}@${e.occurredAt.toISOString()}`}`;

/** Merge by event time (not status rank) so late/corrective scans are kept and can override. */
export function mergeEvents(existing: TrackingEvent[], incoming: TrackingEvent[]): { timeline: TrackingEvent[]; duplicates: number; needsReview: string[] } {
  const seen = new Map(existing.map(e => [ek(e), e]));
  let duplicates = 0;
  for (const e of incoming) { if (seen.has(ek(e))) duplicates++; else seen.set(ek(e), e); }
  const timeline = [...seen.values()].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.receivedAt.getTime() - b.receivedAt.getTime());
  const needsReview: string[] = [];
  const firstTerminal = timeline.findIndex(e => TERMINAL.has(e.canonical));
  if (firstTerminal >= 0 && timeline.slice(firstTerminal + 1).some(e => e.canonical !== timeline[firstTerminal]!.canonical))
    needsReview.push("Event after terminal status — possible carrier correction");
  if (timeline.some(e => e.canonical === "UNMAPPED")) needsReview.push("Unmapped provider status present");
  return { timeline, duplicates, needsReview };
}

export const currentStatus = (t: TrackingEvent[]) => t.length ? t[t.length - 1]!.canonical : null;
export const shouldPoll = (t: TrackingEvent[]) => { const c = currentStatus(t); return c === null || !TERMINAL.has(c); };
