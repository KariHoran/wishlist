# Wishlist

Y2K / Windows-inspired wishlist app with gift reservation and group funding.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL + Prisma
- NextAuth.js (credentials)
- Real-time via SSE (`/api/wishlists/[id]/events`), optional Pusher

## Setup

1. Copy env: `.env` is already present for local Docker Postgres.
2. Start DB:

```bash
npm run db:up
```

3. Install & migrate:

```bash
npm install
npm run db:push
npm run db:seed
```

4. Dev server:

```bash
npm run dev
```

Demo login: `demo@wishlist.app` / `password123`

## Build notes (Windows)

Production build uses Webpack (`next build --webpack`) because Turbopack requires native SWC bindings that may be unavailable in some local setups.

Native optional dependencies for **win32/x64**:

- `@next/swc-win32-x64-msvc`
- `@tailwindcss/oxide-win32-x64-msvc`

If `npm install` skips them (known npm optional-deps bug), reinstall cleanly:

```bash
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

Stop `npm run dev` before `npm run build` — a running dev server can lock Prisma's query engine (`EPERM` on rename).

**Node:** 18.17+, 20 LTS, or 22 (tested on v22.22.0). nvm/fnm not required.

## Deploy (Vercel + Neon)

1. Push repo to GitHub.
2. Import project in Vercel; framework preset: Next.js.
3. Set env vars: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (production URL).
4. Build command: `npm run build` (default). Vercel installs Linux native bindings automatically.

No `vercel.json` required for a standard App Router deploy.

