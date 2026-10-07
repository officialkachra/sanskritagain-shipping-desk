"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { BOX_TYPES, type SimBehavior } from "@shipdesk/core";
import { COOKIE, sign, type Role } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import * as store from "@/lib/store";

const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export async function login(_: unknown, fd: FormData): Promise<{ error: string } | undefined> {
  const pw = process.env.DEMO_LOGIN_PASSWORD;
  if (!pw || !process.env.SESSION_SECRET) return { error: "Login is switched off: DEMO_LOGIN_PASSWORD or SESSION_SECRET is not set on the server." };
  const role = fd.get("role") === "ADMIN" ? "ADMIN" : "PACKER";
  if (!eq(String(fd.get("password") ?? ""), pw)) return { error: "Wrong password." };
  const token = await sign({ user: role === "ADMIN" ? "demo-admin" : "demo-packer", role: role as Role, exp: Date.now() + 8 * 3600e3 });
  (await cookies()).set(COOKIE, token!, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 8 * 3600 });
  redirect("/");
}

export async function logout() { (await cookies()).delete(COOKIE); redirect("/login"); }

export async function savePacking(ref: string, fd: FormData) {
  const s = await requireRole("ADMIN", "PACKER");
  const boxCode = String(fd.get("box") ?? "");
  const w = Number(fd.get("weight"));
  store.savePacking(ref, BOX_TYPES.some(b => b.code === boxCode) ? boxCode : null, Number.isFinite(w) && w > 0 ? Math.round(w) : null, fd.get("stock") === "on", s.user);
  revalidatePath(`/orders/${ref}`); revalidatePath("/");
}

export async function hold(ref: string, fd: FormData) {
  const s = await requireRole("ADMIN", "PACKER");
  const reason = String(fd.get("reason") ?? "").trim();
  store.setHold(ref, reason || "No reason given", s.user);
  revalidatePath(`/orders/${ref}`); revalidatePath("/");
}
export async function release(ref: string) {
  const s = await requireRole("ADMIN");
  store.setHold(ref, null, s.user);
  revalidatePath(`/orders/${ref}`); revalidatePath("/");
}

export async function approve(ref: string) {
  const s = await requireRole("ADMIN");
  store.approve(ref, s.user, s.role);
  revalidatePath(`/orders/${ref}`); revalidatePath("/");
}

export async function book(ref: string, fd: FormData) {
  const s = await requireRole("ADMIN");
  const b = String(fd.get("behavior") ?? "OK");
  const behavior: SimBehavior = (["OK", "TIMEOUT_BUT_BOOKED", "TIMEOUT_NOT_BOOKED", "REJECT"] as const).includes(b as SimBehavior) ? (b as SimBehavior) : "OK";
  await store.book(ref, s.user, behavior);
  revalidatePath(`/orders/${ref}`); revalidatePath("/");
}
