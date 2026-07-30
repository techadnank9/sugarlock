# Technical architecture

See diagrams/technical-architecture.svg for the graph.

## Layers

- Users (3 roles): Sender, Recipient, Confirmer.
- Auth0: identity for all three, plus scoped single-condition access for the
  confirmer.
- Next.js app: the UI (App Router pages) and API routes. All business logic
  lives here.
- Unlock engine: a module inside the app. One function, evaluateCondition, plus
  a runner that iterates locked gifts and flips the ones whose conditions pass.
- Stripe: Checkout for funding, ledger-modeled escrow, optional Connect payout.
- Database (Postgres/Prisma): gifts, users, conditions, confirmations, ledger.

## Request paths

- Sender/Recipient -> Auth0 -> Next.js -> DB (view/create gifts).
- Sender -> Next.js -> Stripe Checkout -> webhook -> Next.js -> DB (funding).
- Confirmer -> Auth0 (scoped) -> Next.js -> DB (write a Confirmation only).
- Cron/poll -> Unlock engine -> DB (flip locked -> unlocked).
- Recipient -> Next.js -> Stripe/ledger -> DB (withdraw -> released).

## Unlock condition types (one engine, four cases)

- time — scheduled; now >= unlockAt. MVP baseline.
- self — recipient marks done, optional proof upload.
- third_party — confirmer approves via scoped Auth0 access. Demo centerpiece.
- data — external API/location signal. Stretch goal.

Adding a new type is a new case in evaluateCondition, not a new subsystem.

## Deployment

- Vercel for the Next.js app and Cron.
- Supabase or Neon for Postgres.
- Stripe + Auth0 dashboards for the external services.
