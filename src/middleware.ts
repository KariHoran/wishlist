import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import * as Sentry from "@sentry/nextjs";

const authRequiredPrefixes = ["/dashboard", "/friends", "/account", "/notifications"];

async function middlewareHandler(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/decor") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const needsAuthGate =
    authRequiredPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname === "/login" ||
    pathname === "/register";

  // Public pages (/, /f/..., etc.) — no JWT. /w/* is excluded via matcher.
  if (!needsAuthGate) {
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

export const middleware = Sentry.wrapMiddlewareWithSentry(middlewareHandler);

export const config = {
  // Exclude static assets, Sentry tunnel, and public share pages.
  // /w/* must not run middleware — even a no-op next() can keep the route dynamic
  // and prevent ISR/CDN caching (x-vercel-cache stays MISS).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|w/).*)",
  ],
};
