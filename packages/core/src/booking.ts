import { checkApproval, snapshotHash, type Approval, type ShipmentSnapshot } from "./approval";
import { CarrierRejected, CarrierTimeout, NotSupported, type CarrierAdapter } from "./adapters/types";

export type BookingState = "IN_FLIGHT" | "CONFIRMED" | "UNKNOWN_OUTCOME" | "FAILED" | "MANUAL_RECONCILIATION";
export interface BookingRecord { businessRef: string; serviceId: string; snapshotHash: string; state: BookingState; awb: string | null; attempts: { at: Date; outcome: string }[] }

/** Ledger contract. The Postgres implementation uses a UNIQUE(businessRef) row + SELECT ... FOR UPDATE.
 *  This in-memory version models the same claim semantics for tests and DEMO. */
export interface BookingLedger {
  claim(ref: string, init: BookingRecord): { claimed: true; record: BookingRecord } | { claimed: false; record: BookingRecord };
  save(rec: BookingRecord): void;
  get(ref: string): BookingRecord | undefined;
}

export class MemoryLedger implements BookingLedger {
  private rows = new Map<string, BookingRecord>();
  claim(ref: string, init: BookingRecord) {
    const ex = this.rows.get(ref);
    if (ex) return { claimed: false as const, record: ex };
    this.rows.set(ref, init); return { claimed: true as const, record: init };
  }
  save(rec: BookingRecord) { this.rows.set(rec.businessRef, structuredClone(rec)); }
  get(ref: string) { const r = this.rows.get(ref); return r ? structuredClone(r) : undefined; }
}

export interface BookingGates { liveWriteEnabled: boolean }

export type BookOutcome =
  | { kind: "CONFIRMED"; awb: string; reused: boolean }
  | { kind: "BLOCKED"; reason: string }
  | { kind: "UNKNOWN_OUTCOME"; note: string }
  | { kind: "FAILED"; reason: string }
  | { kind: "MANUAL_RECONCILIATION"; reason: string };

export async function bookShipment(args: { snapshot: ShipmentSnapshot; approval: Approval | null; adapter: CarrierAdapter; ledger: BookingLedger; gates: BookingGates; now: Date }): Promise<BookOutcome> {
  const { snapshot: s, adapter, ledger, now } = args;
  if (adapter.mode === "LIVE_WRITE" && !args.gates.liveWriteEnabled) return { kind: "BLOCKED", reason: "LIVE_WRITE switch off" };
  if (adapter.mode === "LIVE_READ") return { kind: "BLOCKED", reason: "Adapter in LIVE_READ mode — writes disabled" };
  const appr = checkApproval(args.approval, s, now);
  if (!appr.ok) return { kind: "BLOCKED", reason: appr.reason };

  const hash = snapshotHash(s);
  const c = ledger.claim(s.businessRef, { businessRef: s.businessRef, serviceId: s.serviceId, snapshotHash: hash, state: "IN_FLIGHT", awb: null, attempts: [] });
  let rec = c.record;

  if (!c.claimed) {
    if (rec.state === "CONFIRMED") return { kind: "CONFIRMED", awb: rec.awb!, reused: true }; // reprint/double-click never re-books
    if (rec.state === "MANUAL_RECONCILIATION") return { kind: "MANUAL_RECONCILIATION", reason: "Awaiting operator reconciliation" };
    if (rec.state === "IN_FLIGHT") return { kind: "BLOCKED", reason: "Booking already in flight for this reference" };
    if (rec.snapshotHash !== hash) return { kind: "BLOCKED", reason: "Retry must use identical payload; re-approve as new attempt" };
    if (rec.state === "UNKNOWN_OUTCOME") {
      // Must reconcile before any retry.
      if (!adapter.supports("reconcileByReference")) {
        rec.state = "MANUAL_RECONCILIATION"; rec.attempts.push({ at: now, outcome: "NO_LOOKUP_SUPPORT" }); ledger.save(rec);
        return { kind: "MANUAL_RECONCILIATION", reason: "Carrier offers no reference lookup — unsafe to retry" };
      }
      const r = await adapter.reconcileByReference(s.businessRef);
      if (r.found) {
        rec.state = "CONFIRMED"; rec.awb = r.awb; rec.attempts.push({ at: now, outcome: "RECONCILED_FOUND" }); ledger.save(rec);
        return { kind: "CONFIRMED", awb: r.awb, reused: true };
      }
      rec.attempts.push({ at: now, outcome: "RECONCILED_NOT_FOUND" });
    }
    rec.state = "IN_FLIGHT"; ledger.save(rec);
  }

  try {
    const res = await adapter.book(s);
    rec.state = "CONFIRMED"; rec.awb = res.awb; rec.attempts.push({ at: now, outcome: "BOOKED" });
    ledger.save(rec); // persisted BEFORE success is reported
    return { kind: "CONFIRMED", awb: res.awb, reused: false };
  } catch (e) {
    if (e instanceof CarrierTimeout) {
      rec.state = "UNKNOWN_OUTCOME"; rec.attempts.push({ at: now, outcome: "TIMEOUT" }); ledger.save(rec);
      return { kind: "UNKNOWN_OUTCOME", note: "Reconcile by reference before retrying" };
    }
    if (e instanceof NotSupported) { rec.state = "FAILED"; rec.attempts.push({ at: now, outcome: e.message }); ledger.save(rec); return { kind: "FAILED", reason: e.message }; }
    if (e instanceof CarrierRejected) { rec.state = "FAILED"; rec.attempts.push({ at: now, outcome: `REJECTED ${e.providerCode}` }); ledger.save(rec); return { kind: "FAILED", reason: e.message }; }
    rec.state = "UNKNOWN_OUTCOME"; rec.attempts.push({ at: now, outcome: "UNEXPECTED_ERROR" }); ledger.save(rec);
    return { kind: "UNKNOWN_OUTCOME", note: "Unexpected error treated as unknown outcome" };
  }
}
