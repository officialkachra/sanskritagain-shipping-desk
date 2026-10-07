import { describe, expect, it } from "vitest";
import { bookShipment, MemoryLedger, SimulatedCarrier, snapshotHash, checkApproval, batchCovers, unverifiedLiveAdapter, type Approval } from "../src";
import { NOW, snap } from "./helpers";

const approve = (s = snap(), role = "ADMIN"): Approval => ({ id: "a1", businessRef: s.businessRef, snapshotHash: snapshotHash(s), approvedBy: "u-admin", role, approvedAt: NOW, batchId: null });
const caps = new Set(["book", "reconcileByReference"] as const);
const gates = { liveWriteEnabled: false };

describe("approval", () => {
  it("material change invalidates (weight/address/box/COD/service)", () => {
    const a = approve();
    for (const ch of [{ packedWeightG: 600 }, { serviceId: "x" }, { codAmountPaise: 1 }, { box: { code: "18x12x7_cm", lengthCm: 18, breadthCm: 12, heightCm: 7 } }])
      expect(checkApproval(a, snap(ch), NOW)).toEqual({ ok: false, reason: "STALE_APPROVAL_MATERIAL_CHANGE" });
  });
  it("packer cannot approve", () => expect(checkApproval(approve(snap(), "PACKER"), snap(), NOW).ok).toBe(false));
  it("expired quote blocks", () => {
    const s = snap({ quote: { amountPaise: 1, expiresAt: new Date(NOW.getTime() - 1).toISOString(), source: "d" } });
    expect(checkApproval(approve(s), s, NOW)).toEqual({ ok: false, reason: "QUOTE_EXPIRED" });
  });
  it("batch covers only enumerated items", () => {
    const s = snap(); const other = snap({ businessRef: "SA-9999:1" });
    const batch = { items: [{ businessRef: s.businessRef, snapshotHash: snapshotHash(s) }] };
    expect(batchCovers(batch, s)).toBe(true); expect(batchCovers(batch, other)).toBe(false);
  });
});

describe("booking ledger", () => {
  it("double click / concurrent calls produce one AWB", async () => {
    const led = new MemoryLedger(); const ad = new SimulatedCarrier("BLUEDART", new Set(caps)); const s = snap();
    const [a, b] = await Promise.all([bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW }), bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW })]);
    expect(ad.calls).toBe(1);
    expect([a.kind, b.kind].sort()).toEqual(["BLOCKED", "CONFIRMED"]);
    const again = await bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW });
    expect(again).toMatchObject({ kind: "CONFIRMED", reused: true }); expect(ad.calls).toBe(1);
  });
  it("timeout-but-success reconciles to the existing AWB, no second booking", async () => {
    const led = new MemoryLedger(); const ad = new SimulatedCarrier("DELHIVERY", new Set(caps), "TIMEOUT_BUT_BOOKED"); const s = snap();
    expect((await bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW })).kind).toBe("UNKNOWN_OUTCOME");
    ad.behavior = "OK";
    const r = await bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW });
    expect(r).toMatchObject({ kind: "CONFIRMED", reused: true, awb: "DEMO-DELHIVERY-000001" }); expect(ad.calls).toBe(1);
  });
  it("timeout with no lookup support → manual reconciliation, no retry", async () => {
    const led = new MemoryLedger(); const ad = new SimulatedCarrier("BLUEDART", new Set(["book"] as const), "TIMEOUT_NOT_BOOKED"); const s = snap();
    await bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW });
    const r = await bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW });
    expect(r.kind).toBe("MANUAL_RECONCILIATION"); expect(ad.calls).toBe(1);
  });
  it("timeout, reconcile not found → safe single retry with same payload", async () => {
    const led = new MemoryLedger(); const ad = new SimulatedCarrier("AMAZON_SHIPPING", new Set(caps), "TIMEOUT_NOT_BOOKED"); const s = snap();
    await bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW });
    ad.behavior = "OK";
    expect((await bookShipment({ snapshot: s, approval: approve(s), adapter: ad, ledger: led, gates, now: NOW })).kind).toBe("CONFIRMED");
    expect(led.get(s.businessRef)!.attempts.map(a => a.outcome)).toEqual(["TIMEOUT", "RECONCILED_NOT_FOUND", "BOOKED"]);
  });
  it("no approval / stale approval never calls carrier", async () => {
    const ad = new SimulatedCarrier("BLUEDART", new Set(caps)); const s = snap();
    expect((await bookShipment({ snapshot: s, approval: null, adapter: ad, ledger: new MemoryLedger(), gates, now: NOW })).kind).toBe("BLOCKED");
    expect((await bookShipment({ snapshot: snap({ packedWeightG: 999 }), approval: approve(s), adapter: ad, ledger: new MemoryLedger(), gates, now: NOW })).kind).toBe("BLOCKED");
    expect(ad.calls).toBe(0);
  });
  it("unverified live adapter is read-only and books nothing", async () => {
    const s = snap();
    expect(await bookShipment({ snapshot: s, approval: approve(s), adapter: unverifiedLiveAdapter("BLUEDART"), ledger: new MemoryLedger(), gates: { liveWriteEnabled: true }, now: NOW })).toMatchObject({ kind: "BLOCKED" });
  });
});
