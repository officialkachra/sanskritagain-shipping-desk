import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Action } from "@shipdesk/core";
import { COOKIE, verify, type Session } from "./session";

export async function getSession(): Promise<Session | null> { return verify((await cookies()).get(COOKIE)?.value); }
export async function requireSession(): Promise<Session> { const s = await getSession(); if (!s) redirect("/login"); return s; }
export async function requireCan(action: Action): Promise<Session> {
  const s = await requireSession(); if (!can(s.role, action)) throw new Error(`Not allowed: ${action}`); return s;
}
