import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encode as encodeJwt, decode as decodeJwt, type JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { authenticateCredentials } from "@/lib/credentials-auth";

/** Keep session JWT tiny — oversized JWTs get chunked into dozens of Set-Cookie
 *  headers and browsers abort with net::ERR_HTTP2_PROTOCOL_ERROR.
 *  Never put base64 data: URLs (avatars) into the token. */
function sessionImage(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("data:")) return null;
  return value;
}

function slimToken(token: Record<string, unknown>): JWT {
  return {
    id: typeof token.id === "string" ? token.id : undefined,
    email: typeof token.email === "string" ? token.email : null,
    name: typeof token.name === "string" ? token.name : null,
    picture: sessionImage(token.picture),
    handle: typeof token.handle === "string" ? token.handle : undefined,
    sub: typeof token.sub === "string" ? token.sub : undefined,
    iat: typeof token.iat === "number" ? token.iat : undefined,
    exp: typeof token.exp === "number" ? token.exp : undefined,
    jti: typeof token.jti === "string" ? token.jti : undefined,
  };
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  jwt: {
    async encode(params) {
      const token = slimToken((params.token ?? {}) as Record<string, unknown>);
      return encodeJwt({ ...params, token });
    },
    async decode(params) {
      return decodeJwt(params);
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email = String(credentials?.email ?? "");
          const password = String(credentials?.password ?? "");

          return authenticateCredentials(email, password, {
            findUserByEmail: (e) =>
              prisma.user.findUnique({
                where: { email: e },
                select: {
                  id: true,
                  email: true,
                  displayName: true,
                  avatarUrl: true,
                  handle: true,
                  passwordHash: true,
                },
              }),
            verifyPassword,
          });
        } catch (err) {
          console.error("[auth] authorize failed", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.handle = (user as { handle?: string }).handle;
        token.name = user.name;
        token.email = user.email;
        token.picture = sessionImage(user.image);
      }
      if (trigger === "update" && session) {
        token.name = session.name ?? token.name;
        token.picture = sessionImage(session.image ?? token.picture);
      }
      return slimToken(token as Record<string, unknown>);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.handle = token.handle as string;
      }
      return session;
    },
  },
};
