// Signed session cookie (HMAC-SHA256 via Web Crypto; works in Edge middleware and Node).
// DEMO auth only. Production plan: maintained auth library + MFA + server-side revocation.
export type Role = "ADMIN" | "PACKER" | "SUPPORT";
export interface Session { user: string; role: Role; exp: number }
export const COOKIE = "sd_session";
const enc = new TextEncoder();

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sign(s: Session): Promise<string | null> {
  const k = await key(); if (!k) return null;
  const body = b64url(enc.encode(JSON.stringify(s)));
  return `${body}.${b64url(await crypto.subtle.sign("HMAC", k, enc.encode(body)))}`;
}

export async function verify(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const k = await key(); if (!k) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", k, fromB64url(sig), enc.encode(body));
  if (!ok) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    return s.exp > Date.now() && ["ADMIN", "PACKER", "SUPPORT"].includes(s.role) ? s : null;
  } catch { return null; }
}
