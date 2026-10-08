"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { BOX_TYPES, type SimBehavior, type CarrierActionKind } from "@shipdesk/core";
import { COOKIE, sign, type Role } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import * as store from "@/lib/store";

const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export type ActionState = { ok: boolean; message: string; results?: store.BulkResult } | undefined;
const run = async (fn: () => unknown | Promise<unknown>, okMsg: string, paths: string[]): Promise<ActionState> => {
  try { await fn(); paths.forEach(p => revalidatePath(p)); return { ok: true, message: okMsg }; }
  catch (e) { return { ok: false, message: (e as Error).message }; }
};

export async function login(_: unknown, fd: FormData): Promise<{ error: string } | undefined> {
  const pw = process.env.DEMO_LOGIN_PASSWORD;
  if (!pw || !process.env.SESSION_SECRET) return { error: "Login is switched off: DEMO_LOGIN_PASSWORD or SESSION_SECRET is not set on the server." };
  const r = String(fd.get("role")); const role: Role = r === "ADMIN" ? "ADMIN" : r === "SUPPORT" ? "SUPPORT" : "PACKER";
  if (!eq(String(fd.get("password") ?? ""), pw)) return { error: "Wrong password." };
  const token = await sign({ user: `demo-${role.toLowerCase()}`, role, exp: Date.now() + 8 * 3600e3 });
  (await cookies()).set(COOKIE, token!, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 8 * 3600 });
  redirect("/");
}
export async function logout() { (await cookies()).delete(COOKIE); redirect("/login"); }

const P = (ref: string) => [`/orders/${ref}`, "/"];

export async function savePacking(ref: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession();
  const boxCode = String(fd.get("box") ?? ""); const w = Number(fd.get("weight"));
  return run(() => store.savePacking(s, ref, BOX_TYPES.some(b => b.code === boxCode) ? boxCode : null, Number.isFinite(w) && w > 0 ? Math.round(w) : null, fd.get("stock") === "on"), "Packing saved", P(ref));
}
export async function hold(ref: string, _: ActionState, fd: FormData): Promise<ActionState> { const s = await requireSession(); return run(() => store.setHold(s, ref, String(fd.get("reason") ?? "").trim()), "Order put on hold", P(ref)); }
export async function release(ref: string): Promise<ActionState> { const s = await requireSession(); return run(() => store.releaseHold(s, ref), "Hold released", P(ref)); }
export async function rerun(ref: string): Promise<ActionState> { const s = await requireSession(); let d: string[] = []; const r = await run(() => { d = store.rerun(s, ref); }, "", P(ref)); return r?.ok ? { ok: true, message: `Recommendation rerun. ${d.join("; ") || "No change."} Nothing was booked.` } : r; }
export async function approve(ref: string): Promise<ActionState> { const s = await requireSession(); return run(() => store.approve(s, ref), "Shipment approved", P(ref)); }
export async function book(ref: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession();
  const b = String(fd.get("behavior") ?? "OK");
  const behavior: SimBehavior = (["OK", "TIMEOUT_BUT_BOOKED", "TIMEOUT_NOT_BOOKED", "REJECT"] as const).includes(b as SimBehavior) ? (b as SimBehavior) : "OK";
  try { const out = await store.book(s, ref, behavior); P(ref).forEach(p => revalidatePath(p));
    return { ok: out.kind === "CONFIRMED", message: out.kind === "CONFIRMED" ? `Booked (demo). AWB ${out.awb}${out.reused ? " — existing booking found, not booked again" : ""}` : `${out.kind.replace(/_/g, " ").toLowerCase()}: ${"reason" in out ? out.reason : "note" in out ? out.note : ""}` };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
export async function printLabel(ref: string): Promise<ActionState> { const s = await requireSession(); return run(() => store.printLabel(s, ref), "Existing label printed (synthetic). No booking call.", P(ref)); }
export async function scanPacked(ref: string): Promise<ActionState> { const s = await requireSession(); return run(() => store.scanPacked(s, ref), "Parcel scanned", P(ref)); }

export async function bulkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession();
  const refs = fd.getAll("refs").map(String); const op = fd.get("op") === "hold" ? "hold" : "rerun";
  if (!refs.length) return { ok: false, message: "Select at least one order." };
  const results = store.bulk(s, refs, op, String(fd.get("reason") ?? "Bulk hold"));
  revalidatePath("/");
  const ok = results.filter(r => r.ok).length;
  return { ok: ok === results.length, message: `${op === "hold" ? "Hold" : "Rerun"}: ${ok} of ${results.length} succeeded`, results };
}

export async function ndrRemark(id: string, _: ActionState, fd: FormData): Promise<ActionState> { const s = await requireSession(); const t = String(fd.get("text") ?? "").trim(); if (!t) return { ok: false, message: "Write a remark first." }; return run(() => store.ndrRemark(s, id, t), "Remark saved locally. Nothing was sent.", ["/ndr"]); }
export async function ndrAssign(id: string, _: ActionState, fd: FormData): Promise<ActionState> { const s = await requireSession(); return run(() => store.ndrAssign(s, id, String(fd.get("who") ?? "")), "Assignment saved", ["/ndr"]); }
export async function ndrAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession();
  if (fd.get("confirm") !== "on") return { ok: false, message: "Tick the confirmation box after reviewing the payload." };
  const kind = String(fd.get("kind")) as CarrierActionKind;
  const payload: Record<string, string> = { awb: String(fd.get("awb") ?? "") };
  if (kind === "ADDRESS_UPDATE") payload.landmark = String(fd.get("landmark") ?? "");
  if (kind === "REATTEMPT") payload.date = String(fd.get("date") ?? "");
  return run(() => store.ndrAction(s, id, kind, payload), "Simulated in DEMO. No courier was contacted.", ["/ndr"]);
}
export async function ndrResolve(id: string, _: ActionState, fd: FormData): Promise<ActionState> { const s = await requireSession(); return run(() => store.ndrResolve(s, id, String(fd.get("evidence") ?? "")), "Case resolved", ["/ndr"]); }
export async function handover(key: string, _: ActionState, fd: FormData): Promise<ActionState> { const s = await requireSession(); return run(() => store.recordHandover(s, key, Number(fd.get("count"))), "Handover recorded locally. No pickup API was called.", ["/manifest", "/"]); }
