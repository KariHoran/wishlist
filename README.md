# ✦ Wishlist

[![CI](https://github.com/KariHoran/wishlist/actions/workflows/ci.yml/badge.svg)](https://github.com/KariHoran/wishlist/actions/workflows/ci.yml)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-Vercel-black?logo=vercel)](https://wishlist-ashy-three.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Y2K-inspired wishlist app for sharing gift ideas with friends: reserve surprises, run group funding (including fixed split «складчина»), and see updates in real time — without spoiling who bought what.

**Live demo:** [wishlist-ashy-three.vercel.app](https://wishlist-ashy-three.vercel.app)

## Demo flow (GIF)

> **Record this manually** (ScreenToGif, Kap, or OS screen recorder) and drop the file at `docs/demo-realtime.gif`:
>
> 1. User A (owner) opens a public wishlist and adds an item.
> 2. User B (friend/guest) opens the same list in another browser/incognito.
> 3. User B clicks **Зарезервировать** on an available item.
> 4. User A's tab updates in real time — item shows **💡 Забронировано**, but **without** revealing User B's name (surprise mode).
>
> Then embed:
>
> ```markdown
> ![Realtime reservation demo](docs/demo-realtime.gif)
> ```

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Next.js API Routes, NextAuth.js (credentials) |
| Database | PostgreSQL (Neon in prod, Docker locally), Prisma ORM |
| Real-time | Server-Sent Events (+ optional Pusher) |
| Storage | Vercel Blob for avatars |
| Hosting | Vercel |
| Testing | Vitest (unit + integration), Playwright (E2E) |
| CI | GitHub Actions |

## Key technical decisions

- **Surprise mode for owners** — the wishlist owner never sees *who* reserved or contributed, only that it happened (and optional anonymous messages). Real `userId` is still stored for un-reserve/refunds/admin.
- **Race-safe reservation** — concurrent `PATCH reserve` calls use `updateMany` with `status: AVAILABLE` guard inside a validated flow, so only one guest wins; the other gets `409`.
- **Fixed-split funding** — `Math.ceil(price / N)` per person, last participant pays the remainder; collection auto-closes when `splitParticipants` is reached.
- **Pure business logic** — status transitions, split math, and progress live in `src/lib/*` with Vitest coverage, not buried in React components.
- **Vercel Blob for avatars** — avoids huge base64 strings in JWT/session cookies (which caused HTTP/2 errors when avatars lived in the DB token).
- **SSE-first realtime** — works without Pusher credentials; Pusher is an optional upgrade for scale.

## Architecture

```mermaid
flowchart LR
  subgraph Client
    UI[Next.js React UI]
    SSE[SSE / Pusher client]
  end

  subgraph Server
    API[API Routes]
    Auth[NextAuth JWT]
    RT[Realtime publisher]
  end

  DB[(PostgreSQL / Neon)]
  Blob[(Vercel Blob)]

  UI --> API
  UI --> SSE
  API --> Auth
  API --> DB
  API --> RT
  RT --> SSE
  API --> Blob
```

## Local setup

```bash
git clone https://github.com/KariHoran/wishlist.git
cd wishlist
cp .env.example .env.local   # or .env
npm run db:up                # Docker Postgres on :5432
npm install
npx prisma migrate dev
npm run db:seed              # optional demo data
npm run dev                  # http://localhost:3000
```

Demo login after seed: `demo@wishlist.app` / `password123`

### Tests

```bash
npm test              # Vitest unit + integration (integration in CI / RUN_INTEGRATION_TESTS=1)
npm run test:coverage
npm run test:e2e      # Playwright (starts dev server automatically)
```

Integration tests need Postgres (`npm run db:up`) and:

```bash
# PowerShell
$env:RUN_INTEGRATION_TESTS="1"
$env:TEST_DATABASE_URL="postgresql://wishlist:wishlist@localhost:5432/wishlist_test"
npm test
```

Create the test database once:

```bash
docker exec -it wishlist-db-1 psql -U wishlist -c "CREATE DATABASE wishlist_test;"
```

*(Container name may differ — check `docker ps`.)*

## CI / Deploy

GitHub Actions (`.github/workflows/ci.yml`) on every push/PR to `main`:

1. `npm ci`
2. `npm run lint`
3. `tsc --noEmit`
4. `npm test` (with Postgres service)
5. `npm run build`

**Gate production deploys:** in Vercel → Project → Settings → Git → enable **Deployment Protection** / require the `CI` check to pass before promoting to production. This prevents broken builds from reaching prod.

## Roadmap

- Email/push notifications (not just in-app bell)
- Shareable invite links for wishlists (no friend request required)
- OG/Twitter preview cards for public wishlist URLs
- Payment provider integration (Stripe/YooKassa) instead of honour-system contributions
- Playwright E2E job in CI against preview deployments

## License

MIT — see [LICENSE](LICENSE).
