# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project Overview

**Dynamic Fat Loss Tracker** (动态减脂拉锯战助手) is a single-user-per-account
fat-loss companion web app. It dynamically adjusts daily macro targets (carbs /
protein / fat) over repeating cycles based on the user's body weight trend and
training volume. The UI is in Chinese (Simplified + some Traditional).

Core ideas:
- Onboarding collects gender, weight, workout level, and plan duration.
- A coefficient matrix turns those into daily macro targets.
- Days are grouped into **10-day cycles**. At the end of a cycle, settlement
  adjusts the carb modifier (±10% or hold) based on weight change and how the
  user feels, then recomputes targets for the next cycle.
- Optional AI food recognition reads a photo of a nutrition label and returns
  per-100g macros.

## Tech Stack

- **Framework**: Next.js 14.2.5 (App Router), React 18, TypeScript 5
- **Output**: `standalone` (`next.config.js`), deployed on **Vercel**
- **Icons**: `@phosphor-icons/react`
- **Persistence**: **Upstash Redis** via REST API (production) with a
  `/tmp` filesystem fallback for local dev — see Data & Storage below.
- **Auth**: hand-rolled PBKDF2-SHA512 password hashing + HMAC-SHA256 tokens
- **AI food recognition**: BigModel (智谱) `glm-4v-flash` vision model
- `@vercel/kv` is listed in `package.json` but is **not used**; KV access is
  done with raw `fetch()` against the Upstash REST API in `src/lib/kv.ts`.

## Commands

```bash
npm install
npm run dev      # next dev → http://localhost:3000
npm run build    # next build (standalone output)
npm run start    # next start (serve a production build)
npm run lint     # next lint
```

There is **no test suite** despite `@playwright/test` being a devDependency.
There is no CI workflow in the repo. Deployment happens by pushing to `main`,
which auto-triggers a Vercel build.

## Directory Structure

```
src/
├── middleware.ts            # Route protection (redirects unauthenticated users)
├── app/
│   ├── layout.tsx           # Root layout, fonts, metadata
│   ├── globals.css          # All global styles (CSS variables, components)
│   ├── page.tsx             # "/" → onboarding flow + session-redirect logic
│   ├── login/page.tsx       # Login / register tabs
│   ├── app/page.tsx         # Main dashboard (largest file, ~690 lines)
│   ├── analytics/page.tsx   # Weight trend + macro breakdown charts
│   └── api/                 # API route handlers (see below)
└── lib/
    ├── auth.ts              # hashPassword/verifyPassword, makeToken/parseToken
    ├── accounts.ts          # username → account registry (sync + async/kv)
    ├── algorithm.ts         # COEFFICIENTS matrix + calcDailyTargets + cycle math
    ├── store.ts             # UserState types, get/set state, FOODS database
    └── kv.ts                # Upstash Redis REST helpers + tmp migration
```

## API Routes

All under `src/app/api/`. Most require auth (see Auth below); they return
`{ error }` with a 401 when unauthorized.

| Route | Methods | Purpose |
|---|---|---|
| `auth/register` | POST | Create account, init empty state, set cookie |
| `auth/login` | POST | Verify password, issue token + cookie |
| `auth/session` | GET | Validate `fl_token` cookie, return userId/token |
| `onboarding` | POST | Set user profile, compute targets, start cycle 1 |
| `dashboard` | GET | Today's log, targets, cycle info, sodium, FOODS, favorites |
| `food-log` | GET/POST/DELETE | Today's food entries (totals recomputed on write) |
| `weight` | POST | Record today's weight + update `currentWeight` |
| `cycle-settlement` | GET/POST | Read cycle state / settle cycle & advance |
| `favorites` | GET/POST/DELETE | Per-user favorite foods |
| `analytics` | GET | Weight series w/ moving avg + 7-day macro percentages |
| `recognize-food` | POST | Proxy image to BigModel vision API → macros |
| `debug/flush` | POST | **DESTRUCTIVE** — wipes all Redis keys + accounts |

## Auth Model

- Passwords: PBKDF2-SHA512, 100k iterations, stored as `salt:hash`
  (`src/lib/auth.ts`). Verification uses `timingSafeEqual`.
- Tokens: `base64(userId:expiryMs).base64(HMAC-SHA256)`, 30-day TTL. The HMAC
  secret comes from `process.env.TOKEN_SECRET`; without it, a weak dev fallback
  key is derived. **`TOKEN_SECRET` must be set in production** for tokens to be
  stable/secure across deploys.
- Clients store the token in `localStorage` as `fl_token` and send it as
  `Authorization: Bearer <token>`. A `fl_token` cookie is also set as a fallback
  for `middleware.ts` and `auth/session`.
- API routes resolve the user via `getUserIdFromRequest(req)` (Bearer header).
  `dashboard` additionally falls back to the cookie.
- `middleware.ts` protects `/` and `/analytics`, redirecting to `/login` when
  no token is present (cookie or Bearer header).

Data is isolated per user: every state read/write is keyed by `userId`
(`user:<userId>` in Redis, `user_<userId>.json` on disk).

## Data & Storage

`src/lib/store.ts` and `src/lib/kv.ts` implement a dual backend selected at
runtime by `isRedisConfigured()` (true when both `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` are set):

- **Redis configured**: state is read/written via Upstash REST (`GET`/`SET`
  JSON strings). An in-memory `memoryCache` mirrors writes; it resets on cold
  start, so **always use the async functions** (`getUserStateAsync` /
  `setUserStateAsync`) in routes — the sync versions return empty data when
  Redis is on.
- **Redis not configured (local dev)**: state is persisted to JSON files under
  `/tmp/fatloss_users/` (`accounts.json`, `user_<id>.json`).

Keys: `accounts` (username → account map) and `user:<userId>` (per-user state).
`migrateFromTmp()` exists to copy legacy `/tmp` data into Redis.

The built-in `FOODS` array (a small Chinese food nutrition table) lives in
`store.ts` and is returned by the dashboard route.

## Domain Logic (`src/lib/algorithm.ts`)

- `COEFFICIENTS[gender][workoutLevel]` → per-kg carb/protein/fat coefficients.
  Workout levels are `'2-3' | '4-5' | '6-7' | '8-9'` (sessions/hours per week).
- `calcDailyTargets(gender, workoutLevel, weight, carbModifier)` →
  `{ carbs, protein, fat, calories }`. Only carbs are scaled by `carbModifier`;
  calories use 4/4/9 kcal per gram.
- Cycle math is **10-day based**: `dayIndex = floor((today - startDate) / 1 day)`,
  `cycleNumber = floor(dayIndex / 10) + 1`, `dayOfCycle = (dayIndex % 10) + 1`.
- Settlement (`cycle-settlement` POST): `weightChange > 2 && feeling ===
  'exhausted'` → carb +10%; `weightChange < -0.5` → carb −10%; else hold. Then
  it advances `startDayIndex` by 10 and rebases weight.

> Note: the helper functions `getDayOfCycle` / `getCycleNumber` in
> `algorithm.ts` use `/10` and match the routes; ignore older "3-day" wording in
> the README — the implementation is 10-day.

## Conventions

- **Path alias**: import internal modules via `@/...` (maps to `src/`).
- **TypeScript is loose**: `strict: false`. Routes lean on `e: any` catch
  blocks returning `NextResponse.json({ error }, { status })`.
- **Client components**: pages that use hooks start with `'use client'`. They
  call APIs through a small `apiFetch` helper that injects the Bearer token from
  `localStorage`.
- **Error/UI copy is Chinese** — keep new user-facing strings consistent with
  the existing language.
- **Styling**: a single global `globals.css` with CSS variables (`--accent`,
  `--text2`, etc.) and class names like `card`, `btn-primary`. There is no CSS
  module / Tailwind setup; match existing class conventions.
- **IDs**: use `crypto.randomUUID()` for new entities (food entries, favorites,
  userIds).

## Environment Variables

| Var | Required | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | prod | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | prod | Upstash Redis REST token |
| `TOKEN_SECRET` | prod | HMAC secret for auth tokens (stable across deploys) |
| `BIGMODEL_API_KEY` | for AI | BigModel (智谱) API key for food recognition |

Set these in Vercel project settings. Without Redis vars the app silently falls
back to `/tmp` file storage (fine for local dev, not durable on Vercel).

## Gotchas & Cleanup Notes

- `.env.local` currently contains a committed `BIGMODEL_API_KEY`. Treat it as a
  leaked secret; do not add more secrets to tracked files, and prefer Vercel env
  vars. Rotate the key if this matters.
- Cookie flags are inconsistent: `register` sets `httpOnly:true, secure:true`
  while `login` sets `httpOnly:false, secure:false`. Be intentional if you
  touch this.
- `api/debug/flush` deletes ALL data — never call it casually and consider
  gating/removing it before any real use.
- Several stray files are committed and can be ignored/cleaned:
  `trigger_redeploy_*.tmp`, `fix_vercel_deploy_*.tmp` (empty redeploy triggers),
  and `tsconfig.tsbuildinfo` (build artifact).
- `dashboard` logs token source via `console.error` on every request — noisy by
  design, not an actual error.

## Git Workflow

- `main` is the deploy branch (push → Vercel build). Do feature work on a
  branch and only push to `main` (or open a PR) when explicitly asked.
- Do not commit secrets, `node_modules/`, `.next/`, or `.vercel/` (already in
  `.gitignore`).
