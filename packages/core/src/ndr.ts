import type { Capability } from "./adapters/types";
import { can } from "./permissions";

export type NdrReason = "REFUSED" | "CONSIGNEE_UNAVAILABLE" | "ADDRESS_ISSUE" | "CONTACT_ISSUE" | "OTHER";
export type NdrStatus = "ACTIVE" | "ACTION_PENDING" | "RESOLVED" | "CLOSED";
export type CarrierActionKind = "REATTEMPT" | "ADDRESS_UPDATE" | "RETURN_REQUEST";
export type ActionOutcome = "REQUESTED" | "ACCEPTED" | "REJECTED" | "UNKNOWN";

export interface NdrCase {
  id: string; orderRef: string; awb: string; carrier: string;
  reason: NdrReason; rawCarrierText: string;
  status: NdrStatus; attempts: number; lastAttemptAt: string; openedAt: string; dueAt: string | null;
  assignee: string | null;
  remarks: { at: string; by: string; text: string }[];      // local only — never sent anywhere
  actions: { at: string; by: string; kind: CarrierActionKind; payload: Record<string, string>; outcome: ActionOutcome; note: string }[];
  synthetic: boolean;
}

/** Category from carrier text; original text is always kept on the case. */
export function classifyNdr(text: string): NdrReason {
  const t = text.toLowerCase();
  if (/refus|reject|not accept|cancel by customer/.test(t)) return "REFUSED";
  if (/address|incomplete|wrong location|landmark/.test(t)) return "ADDRESS_ISSUE";
  if (/phone|contact|not reachable|switched off|unreachable/.test(t)) return "CONTACT_ISSUE";
  if (/not available|unavailable|door locked|premises closed|consignee out/.test(t)) return "CONSIGNEE_UNAVAILABLE";
  return "OTHER";
}

export function addRemark(c: NdrCase, by: string, text: string): NdrCase {
  return { ...c, remarks: [...c.remarks, { at: new Date().toISOString(), by, text }] }; // no side effects
}

const CAP: Record<CarrierActionKind, Capability> = { REATTEMPT: "ndrAction", ADDRESS_UPDATE: "ndrAction", RETURN_REQUEST: "ndrAction" };

export type ActionGate = { allowed: true } | { allowed: false; reason: string };

/** Gate for any carrier-directed NDR action. All conditions must hold; a remark or AI summary is never approval. */
export function ndrActionGate(args: { c: NdrCase; kind: CarrierActionKind; role: string; adapterSupports: (cap: Capability) => boolean; currentTrackingStatus: string | null; liveWriteEnabled: boolean; mode: "DEMO" | "LIVE" }): ActionGate {
  const { c } = args;
  if (!can(args.role, "ndr.carrier_action")) return { allowed: false, reason: `Role ${args.role} cannot send carrier actions` };
  if (c.status === "RESOLVED" || c.status === "CLOSED") return { allowed: false, reason: "Case already resolved — no stale actions" };
  if (args.currentTrackingStatus === "DELIVERED" || args.currentTrackingStatus === "RTO_DELIVERED") return { allowed: false, reason: `Latest tracking is ${args.currentTrackingStatus} — recheck before acting` };
  if (!args.adapterSupports(CAP[args.kind])) return { allowed: false, reason: `${c.carrier} adapter does not support ${args.kind} (contract not verified)` };
  if (args.mode === "LIVE" && !args.liveWriteEnabled) return { allowed: false, reason: "Live write switch is off" };
  return { allowed: true };
}
