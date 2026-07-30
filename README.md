# Sugarlock

Time-locked money gifts, built for the Auth0 x Stripe "Built Different" hackathon
(San Francisco, 2026). A sender funds a gift via Stripe, sets an unlock condition,
and the money sits in a ledger-modeled escrow until the condition is met — time,
self-attested, third-party confirmed via a scoped Auth0 role, or data-verified.
The recipient sees it locked, then watches it unlock live, then withdraws.

Full brief: [BUILD_PLAN.md](./BUILD_PLAN.md). Full spec docs and diagrams are in
[docs/](./docs) and [diagrams/](./diagrams). Design source of truth is in
[design/](./design) — see `design/ui-prototype.html` for a clickable mockup of
all five screens.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, `@auth0/nextjs-auth0` v4,
Stripe, Prisma 6 + Postgres, Framer Motion for the unlock reveal.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in real values, see below
npx prisma migrate dev       # creates the schema against DATABASE_URL
npm run dev
```

### Environment variables

See `.env.example` for the full list. Notes:

- **Database** — any Postgres works (Supabase/Neon free tier are both fast to
  provision). `DATABASE_URL` only.
- **Auth0** — this uses SDK v4 (`@auth0/nextjs-auth0` v4.x), whose env vars are
  `AUTH0_DOMAIN` + `APP_BASE_URL` (not the v3-era `AUTH0_ISSUER_BASE_URL` /
  `AUTH0_BASE_URL` you'll see in older tutorials). Create a **Regular Web
  Application** in the Auth0 dashboard, register
  `http://localhost:3000/auth/callback` as an allowed callback URL and
  `http://localhost:3000` as an allowed logout URL. `AUTH0_SECRET` is
  `openssl rand -hex 32`.
- **Stripe** — test-mode keys. Card `4242 4242 4242 4242`, any future expiry,
  any CVC. Webhook endpoint is `/api/stripe/webhook`; for local dev, forward
  events with `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  and put the printed signing secret in `STRIPE_WEBHOOK_SECRET`. If you skip
  the webhook locally, the Stripe Checkout success redirect to `/gift/[id]`
  triggers a same-effect fallback (`/api/gifts/[id]/confirm-funding`) that
  re-checks payment status directly with Stripe.
- **`CONFIRM_TOKEN_SECRET`** — signs the single-purpose confirmer invite links.
  Any random string; `openssl rand -hex 32` works.
- **Stripe Leaderboard** — list the project using code `auth0-sanfrancisco-2026`
  (filter: "Built Different"). Do this early, it's required for judging.

## How it works

- **Roles**: sender and recipient are the same account type — role is derived
  per gift (`lib/roles.ts`), not stored globally. Confirmer is not a global
  role either: it's a signed, single-purpose invite token
  (`lib/confirm-token.ts`) scoped to exactly one `Condition`. The confirmer
  page/API (`app/confirm/[token]`, `app/api/confirm/[token]`) never selects
  `amountCents` — by construction, not by convention.
- **Unlock engine**: one function, `evaluateCondition` (`lib/unlock-engine.ts`),
  handles all four condition types. A runner iterates every `locked` gift and
  flips the ones that pass to `unlocked`. It's wired to both a Vercel Cron
  endpoint (`/api/cron/unlock`, see `vercel.json`) and a poll-on-load fallback
  from the gift detail page, so local dev doesn't need Cron running.
- **Escrow**: modeled as an append-only `LedgerEntry` table
  (`funded` / `unlocked` / `released` rows), not Stripe Connect — "held in
  escrow" for a gift is `sum(funded) - sum(released)`.
- **Gift status machine**: `draft → funded → locked → unlocked → released`.
  The unlock engine is the only thing that ever moves `locked → unlocked`;
  everything else is a direct user action.

## Testing

```bash
npm test    # unit tests for evaluateCondition and the confirm-token sign/verify round-trip
npm run build   # typecheck + compile
```

The unlock engine and confirm-token logic are pure functions and unit tested.
Auth0/Stripe/DB integration paths aren't covered by automated tests in this
repo — they need real credentials to exercise; verify those manually against
the demo script below once `.env.local` is filled in.

## Demo script (~90 seconds)

Grandparent gifts a grandchild's graduation, confirmed by a teacher.

1. Sender (Rose) creates a $500 gift for Amara, condition = teacher confirms.
2. Recipient (Amara) sees it locked: "You can see it. You can't touch it yet."
3. On a second screen/session, the confirmer (Ms. Okafor) opens her scoped
   invite link, sees only the yes/no question, and approves.
4. Amara's screen unlocks live — vessel bursts gold → teal, withdraw appears.
