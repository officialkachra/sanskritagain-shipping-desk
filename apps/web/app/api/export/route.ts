import { NextResponse, type NextRequest } from "next/server";
import { can } from "@shipdesk/core";
import { getSession } from "@/lib/auth";
import { allViews } from "@/lib/store";

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Role-aware export. Customer PII columns only for roles with export.pii. Demo data only. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(s.role, "order.view")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const stage = req.nextUrl.searchParams.get("stage"); const q = (req.nextUrl.searchParams.get("q") ?? "").toLowerCase();
  const pii = can(s.role, "export.pii");
  const head = ["order", "awb", "payment", "pincode", "stage", "recommendation", ...(pii ? ["customer_name", "phone", "address"] : [])];
  const rows = allViews().filter(v => (!stage || v.stage === stage) && (!q || v.order.ref.toLowerCase().includes(q))).map(v => [
    v.order.ref, v.shipment?.awb ?? "", v.order.payment, v.order.customer.pincode, v.stage, v.rec.status,
    ...(pii ? [v.order.customer.name, v.order.customer.phone, v.order.customer.line1] : [])]);
  const csv = [head, ...rows].map(r => r.map(esc).join(",")).join("\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="demo-orders-${stage ?? "all"}.csv"`, "cache-control": "no-store" } });
}
