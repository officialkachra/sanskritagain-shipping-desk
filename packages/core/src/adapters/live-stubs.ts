import type { Carrier } from "../types";
import { NotSupported, type CarrierAdapter } from "./types";

/** Live adapters stay inert until docs/integration-contracts.md records a verified contract for the account. */
export function unverifiedLiveAdapter(carrier: Carrier): CarrierAdapter {
  return {
    carrier, mode: "LIVE_READ",
    supports: () => false,
    book: async () => { throw new NotSupported("book", "CONTRACT_NOT_VERIFIED"); },
    reconcileByReference: async () => { throw new NotSupported("reconcileByReference", "CONTRACT_NOT_VERIFIED"); },
  };
}
