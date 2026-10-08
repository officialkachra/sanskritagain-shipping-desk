import type { Outcome } from "./metrics";

/** RFC4180-ish CSV parser (quoted fields, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const rows: string[][] = []; let row: string[] = []; let f = ""; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}

export type SourceTz = "Asia/Kolkata" | "UTC" | "UNKNOWN";
export interface ImportProfile {
  provider: string;                       // namespace, e.g. CLICKPOST, QUICKSHIP
  columns: { awb: string; status: string; createdAt: string; account?: string; carrier?: string; pickedUpAt?: string; deliveredAt?: string; pincode?: string; city?: string; payment?: string; orderRef?: string; weightG?: string; reportedTat?: string };
  statusMap: Record<string, Outcome>;     // normalised (trim+lowercase) raw status → outcome
  timezone: SourceTz;                     // UNKNOWN is preserved, never assumed IST
}

export interface HistoricalShipment {
  key: string; provider: string; account: string; awb: string;
  outcome: Outcome | "UNKNOWN_STATUS"; rawStatus: string;
  createdAt: Date | null; pickedUpAt: Date | null; deliveredAt: Date | null; sourceTz: SourceTz;
  pincode: string | null; city: string | null; payment: string | null; orderRef: string | null; weightG: number | null; reportedTat: string | null;
  external: true; bookable: false; rowNumber: number;
}

export interface ImportResult {
  provider: string; fileRows: number; imported: number; unchangedReimport: number; duplicatesInFile: number;
  conflicts: { key: string; existing: string; incoming: string; row: number }[];
  errors: { row: number; message: string }[];
  unknownStatuses: Record<string, number>;
  missingColumns: string[];
  shipments: HistoricalShipment[];
}

/** Naive "local" timestamps are stored as if UTC with the source tz recorded; differences between two
 *  same-source timestamps stay valid even when the tz is UNKNOWN. */
export function parseTimestamp(raw: string | undefined, tz: SourceTz): Date | null {
  const v = (raw ?? "").trim(); if (!v) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(v)) { const d = new Date(v); return isNaN(+d) ? null : d; }
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/) ?? v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let y: number, mo: number, d: number, h = 0, mi = 0, se = 0;
  if (m) { [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!]; h = +(m[4] ?? 0); mi = +(m[5] ?? 0); se = +(m[6] ?? 0); }
  else {
    m = v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    [d, mo, y] = [+m[1]!, +m[2]!, +m[3]!]; h = +(m[4] ?? 0); mi = +(m[5] ?? 0); se = +(m[6] ?? 0);
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;
  const naive = new Date(Date.UTC(y, mo - 1, d, h, mi, se));
  if (naive.getUTCDate() !== d || naive.getUTCMonth() !== mo - 1) return null; // e.g. 31-02
  return new Date(naive.getTime() - (tz === "Asia/Kolkata" ? 330 : 0) * 60e3);
}

export function importCsv(text: string, profile: ImportProfile, existing: Map<string, HistoricalShipment> = new Map()): ImportResult {
  const rows = parseCsv(text);
  const res: ImportResult = { provider: profile.provider, fileRows: Math.max(0, rows.length - 1), imported: 0, unchangedReimport: 0, duplicatesInFile: 0, conflicts: [], errors: [], unknownStatuses: {}, missingColumns: [], shipments: [] };
  if (!rows.length) { res.errors.push({ row: 0, message: "Empty file" }); return res; }
  const header = rows[0]!.map(h => h.trim());
  const idx = (name?: string) => (name ? header.indexOf(name) : -1);
  const required: (keyof ImportProfile["columns"])[] = ["awb", "status", "createdAt"];
  res.missingColumns = (Object.entries(profile.columns) as [string, string][]).filter(([, col]) => col && idx(col) < 0).map(([k, col]) => `${k} (“${col}”)`);
  if (required.some(k => idx(profile.columns[k]) < 0)) { res.errors.push({ row: 1, message: `Required column missing: ${res.missingColumns.join(", ")}` }); return res; }
  const map = new Map(Object.entries(profile.statusMap).map(([k, v]) => [k.trim().toLowerCase(), v]));
  const seenInFile = new Map<string, HistoricalShipment>();

  rows.slice(1).forEach((r, i) => {
    const rowNumber = i + 2;
    const get = (k: keyof ImportProfile["columns"]) => { const j = idx(profile.columns[k]); return j >= 0 ? (r[j] ?? "").trim() : ""; };
    const awb = get("awb");
    if (!awb) { res.errors.push({ row: rowNumber, message: "Missing AWB" }); return; }
    const createdRaw = get("createdAt");
    const createdAt = parseTimestamp(createdRaw, profile.timezone);
    if (!createdAt) { res.errors.push({ row: rowNumber, message: `Invalid created timestamp “${createdRaw}”` }); return; }
    const rawStatus = get("status");
    const outcome = map.get(rawStatus.toLowerCase()) ?? "UNKNOWN_STATUS";
    if (outcome === "UNKNOWN_STATUS") res.unknownStatuses[rawStatus || "(blank)"] = (res.unknownStatuses[rawStatus || "(blank)"] ?? 0) + 1;
    const account = get("account") || get("carrier") || "unknown-account";
    const key = `${profile.provider}:${account}:${awb}`;
    const pickedUpAt = parseTimestamp(get("pickedUpAt"), profile.timezone);
    let deliveredAt = parseTimestamp(get("deliveredAt"), profile.timezone);
    if (get("deliveredAt") && !deliveredAt) res.errors.push({ row: rowNumber, message: `Invalid delivered timestamp “${get("deliveredAt")}” (kept shipment, timing excluded)` });
    if (deliveredAt && pickedUpAt && deliveredAt < pickedUpAt) { res.errors.push({ row: rowNumber, message: "Delivered before pickup (timing excluded)" }); deliveredAt = null; }
    const w = Number(get("weightG"));
    const sh: HistoricalShipment = { key, provider: profile.provider, account, awb, outcome, rawStatus, createdAt, pickedUpAt, deliveredAt, sourceTz: profile.timezone,
      pincode: get("pincode") || null, city: get("city") || null, payment: get("payment") || null, orderRef: get("orderRef") || null,
      weightG: Number.isFinite(w) && w > 0 ? w : null, reportedTat: get("reportedTat") || null, external: true, bookable: false, rowNumber };
    const dup = seenInFile.get(key);
    if (dup) {
      if (dup.outcome === sh.outcome && dup.rawStatus === sh.rawStatus) res.duplicatesInFile++;
      else res.conflicts.push({ key, existing: `${dup.rawStatus} (row ${dup.rowNumber})`, incoming: rawStatus, row: rowNumber });
      return;
    }
    seenInFile.set(key, sh);
    const prev = existing.get(key);
    if (prev) {
      if (prev.outcome === sh.outcome && prev.rawStatus === sh.rawStatus) res.unchangedReimport++;
      else res.conflicts.push({ key, existing: `${prev.rawStatus} (earlier import)`, incoming: rawStatus, row: rowNumber });
      return;
    }
    res.shipments.push(sh); res.imported++;
  });
  return res;
}

export interface ReconSummary { unique: number; counts: Record<Outcome | "UNKNOWN_STATUS", number>; closedRto: number | null; createdFrom: Date | null; createdTo: Date | null }
export function reconcile(ships: HistoricalShipment[]): ReconSummary {
  const counts = { DELIVERED: 0, COMPLETED_RTO: 0, PENDING_RTO: 0, OPEN: 0, CANCELLED: 0, LOST: 0, UNKNOWN_STATUS: 0 };
  let from: Date | null = null, to: Date | null = null;
  for (const s of ships) {
    counts[s.outcome]++;
    if (s.createdAt) { if (!from || s.createdAt < from) from = s.createdAt; if (!to || s.createdAt > to) to = s.createdAt; }
  }
  const den = counts.DELIVERED + counts.COMPLETED_RTO;
  return { unique: ships.length, counts, closedRto: den ? counts.COMPLETED_RTO / den : null, createdFrom: from, createdTo: to };
}
