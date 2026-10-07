import { describe, expect, it } from "vitest";
import { mergeEvents, shouldPoll, cohortReport, type TrackingEvent } from "../src";

const ev = (min: number, canonical: TrackingEvent["canonical"], id: string | null = String(min)): TrackingEvent => ({
  carrier: "DELHIVERY", awb: "DEMO1", providerEventId: id, providerStatus: canonical, canonical,
  occurredAt: new Date(Date.UTC(2026, 9, 1, 0, min)), sourceTz: "Asia/Kolkata", location: null, receivedAt: new Date() });

describe("tracking", () => {
  it("dedupes and orders by time despite out-of-order arrival", () => {
    const { timeline, duplicates } = mergeEvents([ev(10, "IN_TRANSIT")], [ev(5, "PICKED_UP"), ev(10, "IN_TRANSIT")]);
    expect(duplicates).toBe(1); expect(timeline.map(e => e.canonical)).toEqual(["PICKED_UP", "IN_TRANSIT"]);
  });
  it("stops polling at terminal; corrective scan after terminal flagged and kept", () => {
    const a = mergeEvents([], [ev(1, "PICKED_UP"), ev(9, "DELIVERED")]);
    expect(shouldPoll(a.timeline)).toBe(false);
    const b = mergeEvents(a.timeline, [ev(20, "NDR")]);
    expect(b.timeline).toHaveLength(3); expect(b.needsReview[0]).toMatch(/correction/);
  });
});

describe("metrics", () => {
  it("closedRTO excludes open/pending (right-censored)", () => {
    const rows = [
      ...Array(90).fill({ cohort: "bd", outcome: "DELIVERED", pickedUpAt: new Date(0), deliveredAt: new Date(48 * 36e5) }),
      ...Array(10).fill({ cohort: "bd", outcome: "COMPLETED_RTO", pickedUpAt: null, deliveredAt: null }),
      ...Array(50).fill({ cohort: "bd", outcome: "OPEN", pickedUpAt: null, deliveredAt: null }),
    ];
    const [r] = cohortReport(rows, 200);
    expect(r!.closedRto).toBeCloseTo(0.1); expect(r!.mature).toBe(false); expect(r!.tatMedianH).toBe(48); expect(r!.tatSample).toBe(90);
  });
});
