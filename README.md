# ✦ Wishlist

[![CI](https://github.com/KariHoran/wishlist/actions/workflows/ci.yml/badge.svg)](https://github.com/KariHoran/wishlist/actions/workflows/ci.yml)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-Vercel-black?logo=vercel)](https://wishlist-ashy-three.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Y2K-inspired wishlist app for sharing gift ideas with friends: reserve surprises, run group funding (including fixed-split «складчина»), and get live updates — without spoiling who bought what.

**Live demo:** [https://wishlist-ashy-three.vercel.app](https://wishlist-ashy-three.vercel.app)

## Demo

| Login | Dashboard | Wishlist |
|-------|-----------|----------|
| ![Login](docs/login.png) | ![Dashboard](docs/dashboard.png) | ![Wishlist](docs/wishlist.png) |

### Realtime reservation GIF

> Drop the recording at `docs/demo-realtime.gif`, then uncomment the image below.
>
> **How to record (ScreenToGif / Kap / OBS) — two windows side by side:**
>
> 1. **Left window (owner):** log in as account A → create a **public** wishlist → add one item → leave the wishlist page open.
> 2. **Right window (guest):** incognito / second browser → log in as account B → open the same wishlist (friends list or public share link `/w/...`).
> 3. On the right, open the item → click **Зарезервировать** → confirm.
> 4. On the left, the card flips to **💡 Забронировано** in real time — **without** showing B’s name (surprise mode).
>
> Suggested length: 10–20 seconds. Export as GIF (~800–1200px wide).

<!-- ![Realtime reservation demo](docs/demo-realtime.gif) -->

### Demo accounts (seed only)

After `npm run db:seed`, you can use:

| Email | Password |
|-------|----------|
| `demo@wishlist.app` | `password123` |
| `katya@wishlist.app`, `anya@wishlist.app`, … | same password |

These are **test fixtures only** — no real payments, no personal data. Change or delete them before any non-demo use.

## Stack

| Layer | Tech |
|-------|------|
| App | **Next.js 16** (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Auth | Auth.js / NextAuth v5 (credentials + JWT sessions) |
| Data | Prisma + PostgreSQL (Neon in production, Docker locally) |
| Hosting | Vercel (app hosting, Blob storage, Cron) |
| Real-time | **Server-Sent Events** by default; optional **Pusher** when keys are set |
| Email | Resend |
| Observability | Sentry (`@sentry/nextjs`) |
| Rate limits | `@upstash/ratelimit` (+ Redis in prod; in-memory fallback) |
| Tests | Vitest (unit/integration), Playwright (E2E) |
| CI | GitHub Actions |

## Features

- **Reserve & fund gifts** — one-person reserve or free-form contributions
- **Fixed split («складчина на N»)** — equal shares, auto-close when N people join; 4th attempt blocked with a clear message
- **Anonymous congratulations** — optional message + «Отправить анонимно»; others see «Аноним», not the real name
- **Public / private wishlists** — private lists stay owner-only; public lists are shareable
- **Friends** — request by handle → accept/decline → mutual list; remove is mutual
- **Public invite links** (`/w/[shareToken]`) — view without an account; reserve redirects to register and returns to the same list; «Обновить ссылку» invalidates the old token
- **Refund tracking** — cancelling a funded item warns the owner, creates refund rows, notifies contributors; «Отметить как возвращено» clears the queue
- **In-app + email notifications** — bell/SSE feed; Resend emails with an account toggle
- **Deadline reminders** — daily Vercel Cron → `/api/cron/deadline-reminders`
- **PWA** — installable (`manifest` + service worker), works as a standalone app
- **OG previews** — dynamic Open Graph images with title + progress bar for share links
- **Security baseline** — CSP and related headers, auth rate limiting, bcrypt passwords

## Design decisions

1. **Surprise mode for owners** — the owner never learns *who* reserved or chipped in (UI and notification copy). Real `userId` is still stored for un-reserve, refunds, and integrity.
2. **Race-safe reservation** — concurrent reserves use Prisma `updateMany` with `status: AVAILABLE` as a guard so only one guest wins; others get `409`.
3. **ISR on public share pages** — `/w/[shareToken]` is `force-static` + `revalidate` so the CDN can cache HTML. Cold Neon hits used to cost multi-second TTFB; cached share pages load in hundreds of milliseconds. Auth personalization hydrates on the client.
4. **CSP with `unsafe-inline` / `unsafe-eval` in `script-src`** — intentional trade-off for Next.js App Router hydration and the image optimizer; still locks down `object-src`, `frame-ancestors`, and third-party connect targets (Sentry, Blob, Unsplash).
5. **Avatars on Vercel Blob, not in the JWT** — large `data:` URLs in session cookies broke HTTP/2 (`ERR_HTTP2_PROTOCOL_ERROR`); slim tokens + Blob URLs fix it.
6. **SSE-first realtime** — works with zero third-party keys; Pusher is an optional scale path when env vars are present.

## Architecture

```mermaid
flowchart LR
  subgraph Client
    UI[Next.js UI / PWA]
    SSE[EventSource SSE]
    PusherJS[Pusher JS optional]
  end

  subgraph Vercel["Vercel"]
    API[App Router + API routes]
    Auth[Auth.js JWT]
    Cron[Cron: deadline-reminders]
    Blob[(Vercel Blob)]
  end

  DB[(PostgreSQL / Neon)]
  Sentry[Sentry]
  Resend[Resend]
  Upstash[(Upstash Redis)]
  PusherAPI[Pusher API]

  UI --> API
  UI --> SSE
  UI -.-> PusherJS
  API --> Auth
  API --> DB
  API --> Blob
  API --> SSE
  API -.-> PusherAPI
  PusherAPI -.-> PusherJS
  Cron --> API
  API --> Resend
  API --> Sentry
  UI --> Sentry
  API -.-> Upstash
```

## Local setup

```bash
git clone https://github.com/KariHoran/wishlist.git
cd wishlist
cp .env.example .env.local
npm run db:up          # Docker Postgres on :5432
npm install
npx prisma migrate dev
npm run db:seed        # optional demo users + lists
npm run dev            # http://localhost:3000
```

Minimum env for local: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`. Everything else is optional (see `.env.example`).

### Tests

```bash
npm test                 # Vitest unit (+ integration when RUN_INTEGRATION_TESTS=1)
npm run test:coverage
npm run test:e2e         # Playwright; starts `npm run dev` unless PLAYWRIGHT_BASE_URL is set
```

Integration tests need Postgres:

```bash
# PowerShell
$env:RUN_INTEGRATION_TESTS="1"
$env:TEST_DATABASE_URL="postgresql://wishlist:wishlist@localhost:5432/wishlist_test"
npm test
```

Create the test DB once (container name may differ — check `docker ps`):

```bash
docker exec -it wishlist-db-1 psql -U wishlist -c "CREATE DATABASE wishlist_test;"
```

### CI

On every push/PR to `main`, GitHub Actions (`.github/workflows/ci.yml`) runs:

1. `npm ci`
2. Lint + `tsc --noEmit`
3. `prisma migrate deploy` against a Postgres service
4. `npm test`
5. `npm run build`

> **Note:** if the GitHub repository is private, the Actions badge and workflow URL return 404 for anonymous viewers. Make the repo public for a portfolio, or keep the badge as an owner-facing link.

## Roadmap

- **Marketplace image scraping** — skipped: major shops block bots; product URL is stored as a plain link instead
- **Real money rails** — Stripe / YooKassa instead of honour-system contributions + manual refunds
- **Wishlist change history** — audit log of edits, cancels, and funding events
- **Web Push** — mobile/desktop push alongside email (PWA shell is already there)
- **E2E in CI** — Playwright against preview deployments once a stable preview URL is wired

## License

MIT — see [LICENSE](LICENSE).
