import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/onboarding/ruc",
  "/api",
  "/_next",
  "/favicon",
  "/images",
  "/videos",
  "/assets",
  "/public",
];

function isPublic(pathname: string) {
  if (pathname === "/") return true; // sólo la home exacta
  // prefijo estricto: evita que "/loginx" matchee con "/login"
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.next();

  // robusto: sólo pedimos onboarding si NO está bloqueado explícitamente
  const needsRuc = token.ruc_locked !== true;

  if (needsRuc && pathname !== "/onboarding/ruc") {
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding/ruc";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
