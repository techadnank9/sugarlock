# Sugarlock pivot: gift-shipping scheduler — design

Date: 2026-07-30

## Context

The originally-built app (`docs/superpowers/plans/2026-07-30-sugarlock-build.md`,
`BUILD_PLAN.md`) is a money-escrow gift app: a sender funds a gift via Stripe,
sets an unlock condition (time / self / third-party confirmer / data), and the
money sits in a ledger-modeled escrow until the condition is met.

The user supplied two design mockups (`design/sugarlock-landing.html`,
`design/sugarlock-calendar-mockup.html`) describing a different product: a
**gift-shipping scheduler**. A sender puts a recipient's special day on a
calendar with an address and a budget; the app suggests a physical product
from a catalog; a "grace period" controls how early shipping can happen so it
lands in a window ending on the day, never later.

These two concepts don't share a data model. This spec replaces the
money-escrow app with the gift-shipping-scheduler concept end to end.

## Scope decisions (confirmed with user)

- **Billing**: marketing-only. The landing page's $11/mo pricing card renders
  but nothing is wired to Stripe. No subscription checkout, no webhook.
- **Product search**: mocked. Port the mockup's static ~30-item catalog and
  tag/budget matching logic as-is. No real Amazon/Target/Walmart API.
- **Status engine**: a scheduled runner, directly analogous to the old
  `evaluateCondition`/unlock-engine — one pure function computes gift status
  from dates, a cron endpoint + poll-on-load fallback advances gifts. No real
  purchase or shipping-carrier integration; this is simulated.
- **Auth roles**: single role. Auth0 login for the sender only. Recipient is
  a name + address on the gift record — no account, no login, no confirmer
  token flow (nothing in the mockups implies a second role).
- **Database**: fresh migration. The dev Supabase DB only has test rows from
  guest-login QA; drop `Condition`/`Confirmation`/`LedgerEntry` and the old
  `Gift` shape entirely rather than trying to migrate data forward.

## Data model

Replaces the full `Condition`/`Confirmation`/`LedgerEntry`/`Gift` shape.

```prisma
enum ScheduledGiftStatus {
  scheduled
  ordered
  delivered
}

model User {
  id          String          @id @default(uuid())
  auth0Id     String          @unique
  email       String          @unique
  displayName String?
  gifts       ScheduledGift[]
  createdAt   DateTime        @default(now())
}

model ScheduledGift {
  id                String              @id @default(uuid())
  user              User                @relation(fields: [userId], references: [id])
  userId            String
  recipientName     String
  address           String
  lat               Float?
  lng               Float?
  occasion          String?
  eventDate         DateTime
  graceDays         Int                 @default(4)
  colorHex          String
  productIcon       String?
  productName       String?
  productPriceCents Int?
  productStore      String?
  status            ScheduledGiftStatus @default(scheduled)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}
```

`upsertUserForSession` / `upsertPendingUser` in `lib/users.ts`:
`upsertPendingUser` goes away (it existed only to pre-create recipient/confirmer
rows by email — no longer needed since recipients aren't users).

## Status engine

`lib/order-engine.ts`:

```ts
function evaluateGiftStatus(
  gift: { eventDate: Date; graceDays: number; status: ScheduledGiftStatus },
  today: Date,
): ScheduledGiftStatus {
  if (gift.status === 'delivered' || today >= gift.eventDate) return 'delivered'
  const graceStart = new Date(gift.eventDate)
  graceStart.setDate(graceStart.getDate() - gift.graceDays)
  if (today >= graceStart) return 'ordered'
  return gift.status
}
```

Monotonic — never regresses a gift that's already advanced further than the
date math implies. `/api/cron/order-check` (replacing `/api/cron/unlock`)
iterates every non-`delivered` `ScheduledGift`, applies this, and persists
changes. The calendar page polls this same endpoint on load, mirroring the old
gift-detail page's poll-on-load fallback for local dev without Cron running.

Status surfaces in the sidebar "Upcoming" list as a small pill (reusing the
`.daystrip-status` visual language already in the landing-page CSS: "Scheduled"
/ "Ordered" / "Delivered").

## Routes

- `GET /api/gifts` — list the session user's gifts (calendar + upcoming list)
- `POST /api/gifts` — create a scheduled gift
- `PATCH /api/gifts/[id]` — edit an existing gift (re-opening the modal on a
  day that already has a gift is edit mode, matching the mockup)
- `GET /api/cron/order-check` — runs the status engine over all gifts
- `app/api/guest`, `lib/session.ts`, `lib/guest-session.ts`, `lib/auth0.ts` —
  unchanged, reused exactly as already built

All gift routes gate on `getAppSession(request)` exactly like the current
`/api/gifts*` routes do today — no change to the auth-check pattern, only to
what the routes do once authenticated.

## Removed

Routes/pages: `app/create`, `app/gift/[id]`, `app/confirm/[token]`,
`app/api/confirm`, `app/api/checkout`, `app/api/stripe/webhook`,
`app/api/gifts/[id]/withdraw`, `app/api/gifts/[id]/confirm-funding`.

Lib: `lib/confirm-token.ts`, `lib/roles.ts`, `lib/stripe.ts`,
`lib/unlock-engine.ts`.

Components: `GiftCard.tsx`, `GiftVessel.tsx`, `RolePill.tsx`, `TopBar.tsx`
(replaced by the new sidebar-based shell).

Tests: `test/confirm-token.test.ts`, `test/unlock-engine.test.ts` (replaced by
new pure-function tests, see below).

Deps: `stripe`, `@stripe/stripe-js`. Env vars: `STRIPE_SECRET_KEY`,
`STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` removed from `.env.example`/`.env.local`.
`CRON_SECRET` stays (still guards `/api/cron/order-check`).

## New components / libs

- `components/calendar/Sidebar.tsx` — brand, "Schedule a gift" button,
  upcoming list (with status pill), legend, account/logout row (the mockup
  has no account UI at all — a small logout link is added at the bottom of
  the sidebar, styled to match its existing muted-text conventions)
- `components/calendar/CalendarTopBar.tsx` — month title, prev/next, "Today"
- `components/calendar/MonthGrid.tsx` / `DayCell.tsx` — the month grid,
  grace-range shading, gift chips
- `components/calendar/ScheduleGiftModal.tsx` — date display, color picker,
  recipient name, address + map + geocode status, product search +
  suggestions, grace slider, save/cancel
- `components/calendar/AddressMap.tsx` — Leaflet wrapper; dynamically
  imported with `ssr: false` since Leaflet needs `window`
- `lib/catalog.ts` — the mockup's static `CATALOG` array + `searchCatalog(query, budget)`,
  ported as a pure, unit-tested function
- `lib/geocode.ts` — `simplifyAddress` (pure, unit tested) + a thin
  `fetchGeocode` wrapper around the Nominatim call (network, not unit tested,
  same convention as the rest of the project)
- `lib/order-engine.ts` — `evaluateGiftStatus`, unit tested

## Pages

- `app/page.tsx` — logged out: landing page (ported from
  `design/sugarlock-landing.html`); nav "Sign in" → `/auth/login`, a small
  "or continue as guest" link preserves the existing guest-login feature next
  to the primary CTAs. Logged in (real or guest): the calendar app shell.
- No more `/create` or `/gift/[id]` pages — creating and editing both happen
  in `ScheduleGiftModal`, opened from a day cell or the sidebar button.

## Design tokens

Landing-page and calendar-mockup palettes are already the same colors
(`--rose #C8385F` ≈ `--raspberry #c8385f`, sage greens close enough to unify).
One token set in `app/globals.css` covers both: `--ink`, `--ink-soft`,
`--ink-faint`, `--line`, `--rose`/`--rose-tint`/`--rose-deep`, `--sage`/
`--sage-tint`, `--gold`/`--gold-tint`. The marketing page keeps its warm
blush (`--blush`) background and Fraunces serif headings; the authenticated
app keeps the calendar mockup's neutral paper (`--bg`/`--panel`) background —
a standard marketing-site-vs-app-dashboard visual split, not an inconsistency.

## Error handling

- Geocoding failures: inline retry link, ported from the mockup as-is
  (network failure or zero results both show a "couldn't find that / try
  again" state).
- Gift creation: `recipientName` and `eventDate` required; no other
  server-side validation beyond what the mockup's form already enforces
  client-side (this matches the original app's validation depth).
- API routes: 401 via `getAppSession` exactly as today; 404 for missing gift
  IDs; 403 if a gift's `userId` doesn't match the session user.

## Testing

Unit tests for the three pure functions: `evaluateGiftStatus`,
`searchCatalog`, `simplifyAddress`. No Auth0/DB/geocode-network integration
tests — consistent with the existing project convention (documented in
`README.md`'s Testing section), which exercises those paths manually against
real credentials instead.

## Out of scope / explicitly cut

- Real Stripe subscription billing (marketing copy only)
- Real product-search APIs (Amazon/Target/Walmart/Best Buy/Etsy) — mocked
  catalog only
- Real order placement / shipping-carrier integration — status changes are
  simulated by date math
- Any second Auth0 role / confirmer / recipient account
- Gift deletion (not present in either mockup) — create and edit only
