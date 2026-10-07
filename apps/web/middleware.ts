import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verify } from "./lib/session";

export async function middleware(req: NextRequest) {
  const s = await verify(req.cookies.get(COOKIE)?.value);
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
export const config = { matcher: ["/((?!login|_next/static|_next/image|favicon.ico|robots.txt).*)"] };
