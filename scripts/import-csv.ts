/** Local-only reconciliation of ORIGINAL shipment exports. Prints totals; persists nothing; never books.
 *  Usage: npm run import:csv -- --profile clickpost|quickship --file /path/export.csv [--profile-json mapping.json]
 *  Column names below are placeholders — confirm against the real export headers and pass --profile-json to override. */
import { readFileSync } from "node:fs";
import { importCsv, reconcile, type ImportProfile } from "../packages/core/src";
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const DEFAULTS: Record<string, ImportProfile> = {
  clickpost: { provider: "CLICKPOST", timezone: "Asia/Kolkata", columns: { awb: "AWB", status: "Status", createdAt: "Shipment Created", account: "Courier Partner", pickedUpAt: "Pickup Date", deliveredAt: "Delivered Date", pincode: "Drop Pincode" },
    statusMap: { delivered: "DELIVERED", "rto delivered": "COMPLETED_RTO", "rto-delivered": "COMPLETED_RTO", "rto initiated": "PENDING_RTO", "rto in transit": "PENDING_RTO", "in transit": "OPEN", "out for delivery": "OPEN", "picked up": "OPEN", cancelled: "CANCELLED", lost: "LOST" } },
  quickship: { provider: "QUICKSHIP", timezone: "UNKNOWN", columns: { awb: "AWB", status: "Status", createdAt: "Created At", account: "Courier" },
    statusMap: { delivered: "DELIVERED", "rto delivered": "COMPLETED_RTO", "rto in transit": "PENDING_RTO", "in transit": "OPEN", cancelled: "CANCELLED" } },
};
const file = arg("file"); const name = arg("profile") ?? "clickpost";
if (!file) { console.error("--file required"); process.exit(1); }
const profile: ImportProfile = arg("profile-json") ? JSON.parse(readFileSync(arg("profile-json")!, "utf8")) : DEFAULTS[name]!;
const r = importCsv(readFileSync(file, "utf8"), profile);
const s = reconcile(r.shipments);
console.log(JSON.stringify({ provider: r.provider, fileRows: r.fileRows, uniqueImported: r.imported, duplicatesInFile: r.duplicatesInFile, conflicts: r.conflicts.length,
  rowErrors: r.errors.length, missingColumns: r.missingColumns, unknownStatuses: r.unknownStatuses, counts: s.counts,
  closedRto: s.closedRto === null ? "N/A" : (s.closedRto * 100).toFixed(2) + "%", createdRange: [s.createdFrom, s.createdTo], timezone: profile.timezone }, null, 2));
if (r.errors.length) console.log("First errors:", r.errors.slice(0, 10));
