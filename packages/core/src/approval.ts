import { createHash } from "node:crypto";
import type { Dims, PaymentMode } from "./types";

/** Every field whose change must invalidate an approval. */
export interface ShipmentSnapshot {
  businessRef: string;               // orderRef:packageSeq
  lines: { variantId: string; qty: number }[];
  destination: { name: string; line1: string; city: string; state: string; pincode: string; phone: string };
  pickupWarehouseId: string;
  payment: PaymentMode;
  codAmountPaise: number;
  packedWeightG: number;
  box: Dims & { code: string };
  serviceId: string;
  quote: { amountPaise: number; expiresAt: string; source: string };
}

const canonical = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonical)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, canonical((v as Record<string, unknown>)[k])]))
  : v;

export function snapshotHash(s: ShipmentSnapshot): string {
  const norm = { ...s, lines: [...s.lines].sort((a, b) => a.variantId.localeCompare(b.variantId)) };
  return createHash("sha256").update(JSON.stringify(canonical(norm))).digest("hex");
}

export interface Approval { id: string; businessRef: string; snapshotHash: string; approvedBy: string; role: string; approvedAt: Date; batchId: string | null }

export type ApprovalCheck = { ok: true } | { ok: false; reason: string };

export function checkApproval(a: Approval | null, current: ShipmentSnapshot, now: Date): ApprovalCheck {
  if (!a) return { ok: false, reason: "NO_APPROVAL" };
  if (a.role !== "ADMIN" && a.role !== "OWNER") return { ok: false, reason: "APPROVER_NOT_AUTHORIZED" };
  if (a.businessRef !== current.businessRef) return { ok: false, reason: "APPROVAL_FOR_DIFFERENT_SHIPMENT" };
  if (a.snapshotHash !== snapshotHash(current)) return { ok: false, reason: "STALE_APPROVAL_MATERIAL_CHANGE" };
  if (new Date(current.quote.expiresAt) <= now) return { ok: false, reason: "QUOTE_EXPIRED" };
  return { ok: true };
}

/** Batch approval only covers the exact enumerated refs+hashes. */
export function batchCovers(batch: { items: { businessRef: string; snapshotHash: string }[] }, s: ShipmentSnapshot): boolean {
  return batch.items.some(i => i.businessRef === s.businessRef && i.snapshotHash === snapshotHash(s));
}
