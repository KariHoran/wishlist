import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const authRequiredPrefixes = ["/dashboard", "/friends", "/account", "/notifications"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/decor") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Auth.js v5 encrypts cookies with salt = cookie name.
  // On HTTPS the cookie is `__Secure-authjs.session-token`; without
  // secureCookie:true getToken looks for `authjs.session-token` and fails,
  // so /dashboard bounces back to /login even after a successful sign-in.
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: req.nextUrl.protocol === "https:",
  });

  if (!token && authRequiredPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (token && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
