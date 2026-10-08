import { createHmac, timingSafeEqual } from "node:crypto";

/** Shopify webhook verification: HMAC-SHA256 of the RAW body with the app secret, base64, compared to
 *  X-Shopify-Hmac-Sha256 in constant time. (Per shopify.dev "verify deliveries"; re-check before live use.) */
export function verifyShopifyHmac(rawBody: Buffer | string, headerHmac: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !headerHmac) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest();
  let given: Buffer;
  try { given = Buffer.from(headerHmac, "base64"); } catch { return false; }
  return given.length === digest.length && timingSafeEqual(given, digest);
}

export interface WebhookReceiptStore { seen(source: string, deliveryId: string): boolean; record(source: string, deliveryId: string): void }
export class MemoryReceipts implements WebhookReceiptStore {
  private s = new Set<string>();
  seen(src: string, id: string) { return this.s.has(`${src}|${id}`); }
  record(src: string, id: string) { this.s.add(`${src}|${id}`); }
}

export type WebhookDecision =
  | { status: 401; outcome: "REJECTED_HMAC" }
  | { status: 400; outcome: "MISSING_DELIVERY_ID" }
  | { status: 200; outcome: "DUPLICATE_IGNORED" }
  | { status: 200; outcome: "QUEUED"; job: { kind: "shopify.order.sync"; topic: string; deliveryId: string; payloadSha: string } };

/** Verify → dedupe → enqueue. Never books, never writes back. Caller persists raw payload privately. */
export function handleShopifyWebhook(args: { rawBody: Buffer | string; headers: Record<string, string | undefined>; secret: string | undefined; receipts: WebhookReceiptStore; sha: (b: Buffer | string) => string }): WebhookDecision {
  const h = (k: string) => args.headers[k] ?? args.headers[k.toLowerCase()];
  if (!verifyShopifyHmac(args.rawBody, h("X-Shopify-Hmac-Sha256"), args.secret)) return { status: 401, outcome: "REJECTED_HMAC" };
  const id = h("X-Shopify-Webhook-Id") ?? h("X-Shopify-Event-Id");
  if (!id) return { status: 400, outcome: "MISSING_DELIVERY_ID" };
  if (args.receipts.seen("shopify", id)) return { status: 200, outcome: "DUPLICATE_IGNORED" };
  args.receipts.record("shopify", id);
  return { status: 200, outcome: "QUEUED", job: { kind: "shopify.order.sync", topic: h("X-Shopify-Topic") ?? "unknown", deliveryId: id, payloadSha: args.sha(args.rawBody) } };
}

/** Minimal typed view of what the sync expects from a GraphQL Order node.
 *  Field names MUST be checked against the pinned Admin API schema before live use. */
export interface ShopifyOrderNode {
  id: string; name: string; createdAt: string; updatedAt: string; cancelledAt: string | null;
  displayFinancialStatus: string | null; displayFulfillmentStatus: string | null;
  paymentGatewayNames: string[]; tags: string[];
  shippingLines: { title: string | null; code: string | null; source: string | null }[];
  shippingAddress: { zip: string | null } | null;
  totalOutstandingPaise: number | null;
  lineItems: { id: string; variantId: string | null; sku: string | null; title: string; quantity: number; currentQuantity: number }[];
  fulfillmentOrders: { id: string; status: string; assignedLocationId: string | null }[];
}

export interface SyncMapping { codGateways: string[]; prepaidGateways: string[]; locationToWarehouse: Record<string, string> }

export interface MappedOrder {
  externalId: string; name: string; stage: "NEW_CASE" | "CANCELLED";
  payment: "PREPAID" | "COD" | null; exceptions: string[];
  rawShipping: string | null; warehouseId: string | null;
  lines: { externalLineId: string; variantId: string | null; sku: string | null; qty: number }[];
  bookingTriggered: false; // structural guarantee: sync never books
}

export function mapShopifyOrder(o: ShopifyOrderNode, m: SyncMapping): MappedOrder {
  const exceptions: string[] = [];
  const gws = o.paymentGatewayNames.map(g => g.toLowerCase());
  const isCod = gws.some(g => m.codGateways.map(x => x.toLowerCase()).includes(g));
  const isPre = gws.some(g => m.prepaidGateways.map(x => x.toLowerCase()).includes(g));
  const payment = isCod && !isPre ? "COD" : isPre && !isCod ? "PREPAID" : null;
  if (!payment) exceptions.push(`Payment gateway not mapped: ${o.paymentGatewayNames.join(", ") || "none"}`);
  const locs = [...new Set(o.fulfillmentOrders.map(f => f.assignedLocationId).filter(Boolean))] as string[];
  const whs = locs.map(l => m.locationToWarehouse[l]).filter(Boolean);
  if (locs.length !== 1 || whs.length !== 1) exceptions.push(`Warehouse not mapped for locations: ${locs.join(", ") || "none"}`);
  const lines = o.lineItems.filter(l => l.currentQuantity > 0).map(l => ({ externalLineId: l.id, variantId: l.variantId, sku: l.sku, qty: l.currentQuantity }));
  if (lines.some(l => !l.variantId)) exceptions.push("Line without variant — packing review");
  if (!o.shippingAddress?.zip) exceptions.push("No shipping pincode");
  const rawShipping = o.shippingLines.map(s => [s.title, s.code, s.source].filter(Boolean).join(" / ")).join(" | ") || null;
  return { externalId: o.id, name: o.name, stage: o.cancelledAt ? "CANCELLED" : "NEW_CASE", payment, exceptions, rawShipping, warehouseId: whs.length === 1 ? whs[0]! : null, lines, bookingTriggered: false };
}
