import type { Carrier, IntegrationMode } from "../types";
import type { ShipmentSnapshot } from "../approval";

export type Capability = "health" | "serviceability" | "rates" | "edd" | "book" | "reconcileByReference" | "fetchDocuments"
  | "track" | "cancel" | "manifest" | "pickup" | "pod" | "ndrAction" | "reverse" | "webhooks";

export class NotSupported extends Error {
  constructor(public capability: Capability, public why: "NOT_OFFERED" | "CONTRACT_NOT_VERIFIED" | "ENTITLEMENT_NOT_VERIFIED" | "MODE_DISABLED") {
    super(`${capability}: ${why}`);
  }
}

export class CarrierTimeout extends Error { constructor() { super("carrier timeout — outcome UNKNOWN"); } }
export class CarrierRejected extends Error { constructor(public providerCode: string, public providerMessage: string, public retryable: boolean) { super(`${providerCode}: ${providerMessage}`); } }

export interface BookResult { awb: string; providerRef: string; raw: unknown; async: boolean }
export type ReconcileResult = { found: true; awb: string; providerRef: string; raw: unknown } | { found: false };

export interface CarrierAdapter {
  carrier: Carrier;
  mode: IntegrationMode;
  supports(c: Capability): boolean;
  book(s: ShipmentSnapshot): Promise<BookResult>;
  reconcileByReference(businessRef: string): Promise<ReconcileResult>;
}
