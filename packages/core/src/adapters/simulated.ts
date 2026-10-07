import type { Carrier } from "../types";
import type { ShipmentSnapshot } from "../approval";
import { CarrierRejected, CarrierTimeout, NotSupported, type BookResult, type Capability, type CarrierAdapter, type ReconcileResult } from "./types";

export type SimBehavior = "OK" | "TIMEOUT_BUT_BOOKED" | "TIMEOUT_NOT_BOOKED" | "REJECT";

/** DEMO-only adapter. Synthetic AWBs prefixed DEMO-. Never contacts a carrier. */
export class SimulatedCarrier implements CarrierAdapter {
  mode = "DEMO" as const;
  calls = 0;
  private booked = new Map<string, { awb: string; providerRef: string }>();
  constructor(public carrier: Carrier, private caps: Set<Capability>, public behavior: SimBehavior = "OK") {}
  supports(c: Capability) { return this.caps.has(c); }
  async book(s: ShipmentSnapshot): Promise<BookResult> {
    this.calls++;
    if (!this.supports("book")) throw new NotSupported("book", "NOT_OFFERED");
    if (this.behavior === "REJECT") throw new CarrierRejected("SIM_PINCODE", "Simulated rejection", false);
    const awb = `DEMO-${this.carrier}-${String(this.calls).padStart(6, "0")}`;
    if (this.behavior === "TIMEOUT_NOT_BOOKED") throw new CarrierTimeout();
    this.booked.set(s.businessRef, { awb, providerRef: `sim-${s.businessRef}` });
    if (this.behavior === "TIMEOUT_BUT_BOOKED") throw new CarrierTimeout();
    return { awb, providerRef: `sim-${s.businessRef}`, raw: { simulated: true }, async: false };
  }
  async reconcileByReference(ref: string): Promise<ReconcileResult> {
    if (!this.supports("reconcileByReference")) throw new NotSupported("reconcileByReference", "NOT_OFFERED");
    const b = this.booked.get(ref);
    return b ? { found: true, ...b, raw: { simulated: true } } : { found: false };
  }
}
