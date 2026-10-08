import { describe, expect, it } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { importCsv, reconcile, parseCsv, parseTimestamp, handleShopifyWebhook, MemoryReceipts, mapShopifyOrder, ndrActionGate, addRemark, classifyNdr,
  buildManifests, can, assertCan, integrationStatus, trackingFreshness, type ImportProfile, type NdrCase } from "../src";

const profile: ImportProfile = { provider: "CLICKPOST", timezone: "Asia/Kolkata",
  columns: { awb: "AWB", status: "Status", createdAt: "Created", account: "Account", pickedUpAt: "Picked", deliveredAt: "Delivered", pincode: "Pincode" },
  statusMap: { delivered: "DELIVERED", "rto delivered": "COMPLETED_RTO", "rto in transit": "PENDING_RTO", "in transit": "OPEN", cancelled: "CANCELLED", lost: "LOST" } };
const csv = (rows: string[]) => ["AWB,Status,Created,Account,Picked,Delivered,Pincode", ...rows].join("\r\n");

describe("CSV import (synthetic fixtures)", () => {
  it("parses quotes, commas, BOM", () => expect(parseCsv('\uFEFFa,b\n"x, y","q""z"\n')).toEqual([["a", "b"], ["x, y", 'q"z']]));
  it("maps outcomes, unknown bucket, invalid timestamps, closedRTO", () => {
    const r = importCsv(csv([
      "A1,Delivered,2026-07-11 10:00,BD,2026-07-11 18:00,2026-07-14 12:00,411001",
      "A2,RTO Delivered,2026-07-12 10:00,BD,,,560064",
      "A3,In Transit,2026-07-13 10:00,DLV,,,500089",
      "A4,Weird Status,2026-07-13 10:00,DLV,,,110001",
      "A5,Delivered,31-02-2026 10:00,DLV,,,110001",
      "A6,Delivered,2026-07-15 09:00,ATS,2026-07-16 09:00,2026-07-15 09:00,110001",
    ]), profile);
    expect(r.imported).toBe(5); expect(r.errors.map(e => e.row)).toEqual([6, 7]);
    expect(r.unknownStatuses).toEqual({ "Weird Status": 1 });
    expect(r.shipments.find(s => s.awb === "A6")!.deliveredAt).toBeNull(); // delivered before pickup excluded from timing
    const s = reconcile(r.shipments);
    expect(s.counts).toMatchObject({ DELIVERED: 2, COMPLETED_RTO: 1, OPEN: 1, UNKNOWN_STATUS: 1 });
    expect(s.closedRto).toBeCloseTo(1 / 3);
    expect(r.shipments.every(x => x.bookable === false && x.external === true)).toBe(true);
  });
  it("duplicates vs conflicts in file; namespaced by account", () => {
    const r = importCsv(csv(["X,Delivered,2026-07-11,BD,,,", "X,Delivered,2026-07-11,BD,,,", "X,Lost,2026-07-11,BD,,,", "X,Delivered,2026-07-11,DLV,,,"]), profile);
    expect(r.duplicatesInFile).toBe(1); expect(r.conflicts).toHaveLength(1); expect(r.imported).toBe(2);
  });
  it("re-import is idempotent; changed outcome is reported as conflict, not merged", () => {
    const first = importCsv(csv(["X,In Transit,2026-07-11,BD,,,"]), profile);
    const ex = new Map(first.shipments.map(s => [s.key, s]));
    expect(importCsv(csv(["X,In Transit,2026-07-11,BD,,,"]), profile, ex)).toMatchObject({ imported: 0, unchangedReimport: 1 });
    expect(importCsv(csv(["X,Delivered,2026-07-11,BD,,,"]), profile, ex).conflicts).toHaveLength(1);
  });
  it("zero denominator → N/A (null), young cohort censored", () => {
    const r = importCsv(csv(["Q1,In Transit,2026-10-02,QS,,,", "Q2,RTO In Transit,2026-10-02,QS,,,"]), { ...profile, provider: "QUICKSHIP", timezone: "UNKNOWN" });
    expect(reconcile(r.shipments).closedRto).toBeNull();
    expect(r.shipments[0]!.sourceTz).toBe("UNKNOWN");
  });
  it("UNKNOWN tz is not shifted to IST", () => {
    expect(parseTimestamp("2026-10-02 10:00", "UNKNOWN")!.toISOString()).toBe("2026-10-02T10:00:00.000Z");
    expect(parseTimestamp("2026-10-02 10:00", "Asia/Kolkata")!.toISOString()).toBe("2026-10-02T04:30:00.000Z");
  });
  it("missing required column fails with a clear error", () => expect(importCsv("Foo,Bar\n1,2", profile).errors[0]!.message).toMatch(/Required column missing/));
});

describe("Shopify webhook + mapping", () => {
  const secret = "test-secret-not-real"; const body = '{"id":1}';
  const sig = createHmac("sha256", secret).update(body).digest("base64");
  const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
  it("valid HMAC queues; replay ignored; bad HMAC rejected", () => {
    const rec = new MemoryReceipts();
    const h = { "X-Shopify-Hmac-Sha256": sig, "X-Shopify-Webhook-Id": "d1", "X-Shopify-Topic": "orders/create" };
    expect(handleShopifyWebhook({ rawBody: body, headers: h, secret, receipts: rec, sha }).outcome).toBe("QUEUED");
    expect(handleShopifyWebhook({ rawBody: body, headers: h, secret, receipts: rec, sha }).outcome).toBe("DUPLICATE_IGNORED");
    expect(handleShopifyWebhook({ rawBody: body + " ", headers: h, secret, receipts: rec, sha }).outcome).toBe("REJECTED_HMAC");
    expect(handleShopifyWebhook({ rawBody: body, headers: h, secret: undefined, receipts: rec, sha }).outcome).toBe("REJECTED_HMAC");
  });
  it("mapped order never books; unknown gateway/warehouse/variant become exceptions; edits use current qty", () => {
    const m = mapShopifyOrder({ id: "gid://shopify/Order/1", name: "#1001", createdAt: "", updatedAt: "", cancelledAt: null, displayFinancialStatus: "PAID", displayFulfillmentStatus: "UNFULFILLED",
      paymentGatewayNames: ["mystery pay"], tags: [], shippingLines: [{ title: "Express Shipping", code: null, source: "shopify" }], shippingAddress: { zip: "411001" }, totalOutstandingPaise: 0,
      lineItems: [{ id: "l1", variantId: null, sku: null, title: "x", quantity: 2, currentQuantity: 1 }, { id: "l2", variantId: "v2", sku: "S2", title: "y", quantity: 1, currentQuantity: 0 }],
      fulfillmentOrders: [{ id: "fo1", status: "OPEN", assignedLocationId: "loc-unknown" }] }, { codGateways: ["Cash on Delivery (COD)"], prepaidGateways: ["razorpay"], locationToWarehouse: {} });
    expect(m.bookingTriggered).toBe(false); expect(m.payment).toBeNull(); expect(m.exceptions).toHaveLength(3);
    expect(m.lines).toEqual([{ externalLineId: "l1", variantId: null, sku: null, qty: 1 }]);
    expect(m.rawShipping).toBe("Express Shipping / shopify");
  });
});

describe("permissions (server-side policy)", () => {
  it("packer cannot approve/book/export PII/act on NDR", () => {
    for (const a of ["booking.approve", "booking.book", "export.pii", "ndr.carrier_action", "order.release"] as const) expect(can("PACKER", a)).toBe(false);
    expect(() => assertCan("PACKER", "booking.book")).toThrow(); expect(can("PACKER", "packing.edit")).toBe(true);
    expect(can("HACKER", "order.view")).toBe(false);
  });
});

describe("NDR", () => {
  const base: NdrCase = { id: "n1", orderRef: "D1", awb: "A", carrier: "DELHIVERY", reason: "CONTACT_ISSUE", rawCarrierText: "Customer not reachable", status: "ACTIVE", attempts: 1, lastAttemptAt: "", openedAt: "", dueAt: null, assignee: null, remarks: [], actions: [], synthetic: true };
  const gate = (o: Partial<Parameters<typeof ndrActionGate>[0]>) => ndrActionGate({ c: base, kind: "REATTEMPT", role: "ADMIN", adapterSupports: () => true, currentTrackingStatus: "NDR", liveWriteEnabled: false, mode: "DEMO", ...o });
  it("classifies but keeps raw text", () => { expect(classifyNdr("Door locked")).toBe("CONSIGNEE_UNAVAILABLE"); expect(classifyNdr("Customer refused")).toBe("REFUSED"); });
  it("remark only appends locally", () => { const c = addRemark(base, "u", "call tomorrow"); expect(c.remarks).toHaveLength(1); expect(c.actions).toHaveLength(0); });
  it("gates: role, resolved, delivered recheck, unsupported capability, live switch", () => {
    expect(gate({}).allowed).toBe(true);
    expect(gate({ role: "SUPPORT" }).allowed).toBe(false);
    expect(gate({ c: { ...base, status: "RESOLVED" } }).allowed).toBe(false);
    expect(gate({ currentTrackingStatus: "DELIVERED" }).allowed).toBe(false);
    expect(gate({ adapterSupports: () => false })).toMatchObject({ allowed: false, reason: expect.stringMatching(/not support/) });
    expect(gate({ mode: "LIVE" }).allowed).toBe(false);
  });
});

describe("manifest, config, freshness", () => {
  it("groups by warehouse/carrier/IST date and reconciles", () => {
    const b = buildManifests([
      { awb: "1", orderRef: "a", carrier: "BLUEDART", warehouseId: "w", bookedAt: new Date("2026-10-08T19:00:00Z"), labelPrinted: true, packedScanned: true },
      { awb: "2", orderRef: "b", carrier: "BLUEDART", warehouseId: "w", bookedAt: new Date("2026-10-08T17:00:00Z"), labelPrinted: false, packedScanned: true },
    ], () => false);
    expect(b.map(x => x.dispatchDate).sort()).toEqual(["2026-10-08", "2026-10-09"]);
    expect(b.find(x => x.awbs.includes("2"))!.missingLabels).toEqual(["2"]);
    expect(b[0]!.states.carrierManifest).toBe("NOT_SUPPORTED"); expect(b[0]!.kind).toBe("LOCAL_HANDOVER_LIST");
  });
  it("integration status never leaks values and needs a verified contract", () => {
    const st = integrationStatus({ BLUEDART_ACCOUNT_CONFIG_SECRET_REF: "secret-value-123", BLUEDART_LIVE_READ: "true" });
    const bd = st.find(s => s.key === "BLUEDART")!;
    expect(bd.state).toBe("CONFIGURED_CONTRACT_UNVERIFIED"); expect(JSON.stringify(st)).not.toContain("secret-value-123");
    expect(st.find(s => s.key === "SHOPIFY")!.state).toBe("NOT_CONFIGURED");
  });
  it("tracking freshness", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(trackingFreshness([], null, now)).toBe("NEVER_FETCHED");
    expect(trackingFreshness([], new Date("2026-10-07T00:00:00Z"), now)).toBe("STALE");
  });
});
