import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, verify, type Role, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  return verify((await cookies()).get(COOKIE)?.value);
}
export async function requireSession(): Promise<Session> {
  const s = await getSession(); if (!s) redirect("/login"); return s;
}
/** Server-side, deny-by-default role check for every write. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await requireSession();
  if (!roles.includes(s.role)) throw new Error(`Not allowed for role ${s.role}`);
  return s;
}
