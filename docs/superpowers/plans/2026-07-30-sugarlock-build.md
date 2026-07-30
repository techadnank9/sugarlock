# Sugarlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Sugarlock app (time-locked money gifts, Auth0 + Stripe hackathon project) per `BUILD_PLAN.md`, all 4 phases, and get it pushed to `https://github.com/techadnank9/sugarlock`.

**Architecture:** Next.js 14 App Router + TypeScript monolith. All business logic in API routes and `lib/`. Postgres via Prisma. Auth0 for identity (sender/recipient are the same account type; confirmer is a per-condition scoped grant via a signed token, not a global role). Stripe Checkout funds a gift; escrow is modeled as an append-only `LedgerEntry` table, not Stripe Connect. One `evaluateCondition` function drives all four unlock types; a cron/poll runner flips `locked` → `unlocked`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, `@auth0/nextjs-auth0`, `stripe`, Prisma + Postgres, Framer Motion, Vitest (unit tests for pure logic only — no test runner exists for the UI/integration paths since Auth0/Stripe/DB are external and uncredentialed in this environment).

**Known constraint — no live credentials:** This environment has no Auth0 tenant, Stripe account, or Postgres instance. Every task below writes real, spec-correct code against `.env.example`'s variable names. Verification for integration-shaped code is `npm run build` (typecheck + compile) and unit tests on pure functions, not a live end-to-end run. Do not fabricate credentials or skip wiring — leave `.env.local` unset (gitignored) and let the app fail closed at runtime until the user supplies real values.

---

## File structure

```
sugarlock/
  prisma/schema.prisma
  lib/
    prisma.ts          - Prisma client singleton
    auth0.ts            - Auth0 SDK client/config
    stripe.ts           - Stripe client singleton
    roles.ts            - derive sender/recipient role for a user+gift pair
    confirm-token.ts    - sign/verify single-purpose confirmer JWT
    unlock-engine.ts    - evaluateCondition + runUnlockEngine
    money.ts            - cents <-> display formatting
  middleware.ts          - Auth0 route protection for /gift/*, /create
  app/
    layout.tsx
    globals.css          - design tokens merged in
    page.tsx              - home (sender+recipient combined view)
    create/page.tsx        - gift creation form
    gift/[id]/page.tsx      - gift detail: locked / unlocked / released states
    confirm/[token]/page.tsx - confirmer scoped yes/no screen
    api/
      auth/[auth0]/route.ts
      gifts/route.ts             - POST create draft gift
      gifts/[id]/route.ts        - GET gift detail (amount-gated)
      gifts/[id]/withdraw/route.ts - POST release
      checkout/route.ts           - POST create Stripe Checkout session
      stripe/webhook/route.ts     - checkout.session.completed handler
      confirm/[token]/route.ts    - GET validate token, POST decision
      cron/unlock/route.ts        - runs unlock engine over all locked gifts
  components/
    TopBar.tsx
    RolePill.tsx
    GiftVessel.tsx        - Framer Motion locked/unlock animation
    GiftCard.tsx
  test/
    unlock-engine.test.ts
    confirm-token.test.ts
  .env.example            (already present)
  .gitignore
  package.json, tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js, vitest.config.ts
```

---

## Task 1: Scaffold Next.js app + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `postcss.config.js`, `tailwind.config.ts`, `.gitignore`, `vitest.config.ts`
- Modify: none

- [ ] **Step 1: Scaffold with create-next-app**

Run from `/Users/adnan/Documents/sugarlock`:

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm
```

This will complain the directory isn't empty (README.md, BUILD_PLAN.md, docs/, design/, diagrams/, .env.example exist). Answer yes to proceed in a non-empty directory when prompted.

- [ ] **Step 2: Add remaining runtime deps**

```bash
npm install @auth0/nextjs-auth0 stripe @stripe/stripe-js @prisma/client framer-motion jose
npm install -D prisma vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 3: Add vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: 'node' },
})
```

- [ ] **Step 4: Add test script to package.json**

Add to `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds (default Next.js starter page).

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js app on top of handoff package"
```

---

## Task 2: Prisma schema + client

**Files:**
- Create: `prisma/schema.prisma`, `lib/prisma.ts`

- [ ] **Step 1: Write schema** (verbatim from `docs/DATA_MODEL.md` — this is the agreed schema, do not modify it)

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum GiftStatus {
  draft
  funded
  locked
  unlocked
  released
}

enum ConditionType {
  time
  self
  third_party
  data
}

enum Decision {
  pending
  approved
  declined
}

model User {
  id             String   @id @default(uuid())
  auth0Id        String   @unique
  email          String   @unique
  displayName    String?
  sentGifts      Gift[]   @relation("sender")
  receivedGifts  Gift[]   @relation("recipient")
  confirmations  Confirmation[]
  createdAt      DateTime @default(now())
}

model Gift {
  id           String        @id @default(uuid())
  sender       User          @relation("sender", fields: [senderId], references: [id])
  senderId     String
  recipient    User          @relation("recipient", fields: [recipientId], references: [id])
  recipientId  String
  amountCents  Int
  note         String?
  status       GiftStatus    @default(draft)
  stripeRef    String?
  condition    Condition?
  ledger       LedgerEntry[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Condition {
  id            String         @id @default(uuid())
  gift          Gift           @relation(fields: [giftId], references: [id])
  giftId        String         @unique
  type          ConditionType
  params        Json
  unlockAt      DateTime?
  confirmations Confirmation[]
}

model Confirmation {
  id           String    @id @default(uuid())
  condition    Condition @relation(fields: [conditionId], references: [id])
  conditionId  String
  confirmer    User      @relation(fields: [confirmerId], references: [id])
  confirmerId  String
  decision     Decision  @default(pending)
  decidedAt    DateTime?
}

model LedgerEntry {
  id           String   @id @default(uuid())
  gift         Gift     @relation(fields: [giftId], references: [id])
  giftId       String
  event        String
  amountCents  Int
  at           DateTime @default(now())
}
```

- [ ] **Step 2: Prisma client singleton**

`lib/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" — succeeds without a live `DATABASE_URL` since generate only reads the schema.

- [ ] **Step 4: Commit**

```bash
git add prisma lib/prisma.ts
git commit -m "feat: add Prisma schema and client singleton"
```

---

## Task 3: Unlock engine (pure logic, test-first)

**Files:**
- Create: `lib/unlock-engine.ts`
- Test: `test/unlock-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

`test/unlock-engine.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { evaluateCondition } from '../lib/unlock-engine'

describe('evaluateCondition', () => {
  it('time: unlocks when now is past unlockAt', () => {
    const past = new Date(Date.now() - 1000)
    expect(evaluateCondition({ type: 'time', unlockAt: past, params: {} })).toBe(true)
  })

  it('time: stays locked when unlockAt is in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60)
    expect(evaluateCondition({ type: 'time', unlockAt: future, params: {} })).toBe(false)
  })

  it('self: unlocks when params.markedDone is true', () => {
    expect(evaluateCondition({ type: 'self', unlockAt: null, params: { markedDone: true } })).toBe(true)
    expect(evaluateCondition({ type: 'self', unlockAt: null, params: { markedDone: false } })).toBe(false)
  })

  it('third_party: unlocks only when an approved confirmation exists', () => {
    expect(
      evaluateCondition({
        type: 'third_party',
        unlockAt: null,
        params: {},
        confirmations: [{ decision: 'pending' }, { decision: 'approved' }],
      })
    ).toBe(true)
    expect(
      evaluateCondition({
        type: 'third_party',
        unlockAt: null,
        params: {},
        confirmations: [{ decision: 'pending' }, { decision: 'declined' }],
      })
    ).toBe(false)
  })

  it('data: stub always returns params.signalMet', () => {
    expect(evaluateCondition({ type: 'data', unlockAt: null, params: { signalMet: true } })).toBe(true)
    expect(evaluateCondition({ type: 'data', unlockAt: null, params: {} })).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/unlock-engine.ts` does not exist / `evaluateCondition` not exported.

- [ ] **Step 3: Implement**

`lib/unlock-engine.ts`:
```ts
import { prisma } from './prisma'

export type ConditionInput = {
  type: 'time' | 'self' | 'third_party' | 'data'
  unlockAt: Date | null
  params: Record<string, unknown>
  confirmations?: { decision: string }[]
}

export function evaluateCondition(condition: ConditionInput): boolean {
  switch (condition.type) {
    case 'time':
      return condition.unlockAt !== null && new Date() >= condition.unlockAt
    case 'self':
      return condition.params.markedDone === true
    case 'third_party':
      return (condition.confirmations ?? []).some((c) => c.decision === 'approved')
    case 'data':
      return condition.params.signalMet === true
    default:
      return false
  }
}

export async function runUnlockEngine(): Promise<{ checked: number; unlocked: string[] }> {
  const lockedGifts = await prisma.gift.findMany({
    where: { status: 'locked' },
    include: { condition: { include: { confirmations: true } } },
  })

  const unlocked: string[] = []

  for (const gift of lockedGifts) {
    if (!gift.condition) continue
    const passes = evaluateCondition({
      type: gift.condition.type,
      unlockAt: gift.condition.unlockAt,
      params: (gift.condition.params as Record<string, unknown>) ?? {},
      confirmations: gift.condition.confirmations,
    })
    if (!passes) continue

    await prisma.$transaction([
      prisma.gift.update({ where: { id: gift.id }, data: { status: 'unlocked' } }),
      prisma.ledgerEntry.create({
        data: { giftId: gift.id, event: 'unlocked', amountCents: gift.amountCents },
      }),
    ])
    unlocked.push(gift.id)
  }

  return { checked: lockedGifts.length, unlocked }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — all 6 `evaluateCondition` cases.

- [ ] **Step 5: Commit**

```bash
git add lib/unlock-engine.ts test/unlock-engine.test.ts
git commit -m "feat: add unlock engine with evaluateCondition and runner"
```

---

## Task 4: Confirmer signed-token invite (test-first)

**Files:**
- Create: `lib/confirm-token.ts`
- Test: `test/confirm-token.test.ts`

- [ ] **Step 1: Write the failing tests**

`test/confirm-token.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { signConfirmToken, verifyConfirmToken } from '../lib/confirm-token'

beforeAll(() => {
  process.env.CONFIRM_TOKEN_SECRET = 'test-secret-at-least-32-bytes-long!!'
})

describe('confirm token', () => {
  it('signs and verifies a valid token round-trip', async () => {
    const token = await signConfirmToken('condition-123')
    const payload = await verifyConfirmToken(token)
    expect(payload.conditionId).toBe('condition-123')
  })

  it('rejects a tampered token', async () => {
    const token = await signConfirmToken('condition-123')
    const tampered = token.slice(0, -2) + 'xx'
    await expect(verifyConfirmToken(tampered)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/confirm-token.ts`:
```ts
import { SignJWT, jwtVerify } from 'jose'

function secretKey(): Uint8Array {
  const secret = process.env.CONFIRM_TOKEN_SECRET
  if (!secret) throw new Error('CONFIRM_TOKEN_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signConfirmToken(conditionId: string): Promise<string> {
  return new SignJWT({ conditionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey())
}

export async function verifyConfirmToken(token: string): Promise<{ conditionId: string }> {
  const { payload } = await jwtVerify(token, secretKey())
  if (typeof payload.conditionId !== 'string') throw new Error('Malformed confirm token')
  return { conditionId: payload.conditionId }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/confirm-token.ts test/confirm-token.test.ts
git commit -m "feat: add signed single-purpose confirmer invite tokens"
```

---

## Task 5: Auth0 wiring + role helper + middleware

**Files:**
- Create: `lib/auth0.ts`, `lib/roles.ts`, `app/api/auth/[auth0]/route.ts`, `middleware.ts`

- [ ] **Step 1: Auth0 client**

`lib/auth0.ts`:
```ts
import { Auth0Client } from '@auth0/nextjs-auth0/server'

export const auth0 = new Auth0Client()
```

- [ ] **Step 2: Auth route handler**

`app/api/auth/[auth0]/route.ts`:
```ts
import { auth0 } from '@/lib/auth0'

export const GET = auth0.handleAuth()
```

(If the installed `@auth0/nextjs-auth0` major version does not export `handleAuth`/`Auth0Client` under these exact names, use the version actually installed's documented App Router integration — check `node_modules/@auth0/nextjs-auth0/package.json` version and its README before deviating, and note the deviation in the commit message.)

- [ ] **Step 3: Role helper**

Sender/recipient are the same account type; role is derived per gift, never stored globally.

`lib/roles.ts`:
```ts
export type GiftRole = 'sender' | 'recipient' | 'none'

export function roleForGift(userId: string, gift: { senderId: string; recipientId: string }): GiftRole {
  if (gift.senderId === userId) return 'sender'
  if (gift.recipientId === userId) return 'recipient'
  return 'none'
}
```

- [ ] **Step 4: Middleware protecting authenticated routes**

`middleware.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'

export async function middleware(request: NextRequest) {
  return auth0.middleware(request)
}

export const config = {
  matcher: ['/create', '/gift/:path*', '/api/gifts/:path*', '/api/checkout'],
}
```

`/confirm/[token]` is intentionally excluded from this matcher — it authenticates via the signed token (Task 4) rather than a full session, per `docs/AUTH0_SETUP.md`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: compiles. Runtime Auth0 calls will fail without real tenant env vars — that's expected in this environment; typecheck/compile is the bar for this step.

- [ ] **Step 6: Commit**

```bash
git add lib/auth0.ts lib/roles.ts app/api/auth middleware.ts
git commit -m "feat: wire Auth0 handler, middleware, and per-gift role helper"
```

---

## Task 6: Design tokens + Tailwind theme + app shell

**Files:**
- Modify: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`
- Create: `components/TopBar.tsx`, `components/RolePill.tsx`

- [ ] **Step 1: Merge design tokens into globals.css**

Prepend the contents of `design/globals.css` (already in the repo — read it, do not re-derive the values) to the top of `app/globals.css`, above the Tailwind `@tailwind` directives it already contains from scaffolding. Keep the `.is-locked` / `.is-unlocked` state-color rule intact — it is called out in `design/design-tokens.md` as "the one rule that carries the whole visual identity."

- [ ] **Step 2: Map tokens into Tailwind theme**

`tailwind.config.ts` — extend `theme.extend.colors` and `fontFamily`:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10182b',
        'ink-soft': '#1a2540',
        'ink-card': '#1f2c4d',
        gold: '#d9a441',
        'gold-soft': '#e8c67e',
        'gold-dim': '#8a6d33',
        paper: '#f3efe4',
        'paper-dim': '#c9c2b2',
        teal: '#4ca894',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      borderRadius: {
        card: '18px',
        control: '14px',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 3: Load fonts via next/font in layout**

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Sugarlock',
  description: 'Send money that unlocks only when a chosen condition is met.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="bg-ink text-paper font-body">{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: TopBar + RolePill components**

`components/RolePill.tsx`:
```tsx
export function RolePill({ role }: { role: 'sender' | 'recipient' | 'confirmer' }) {
  return (
    <span className="rounded-full border border-gold-dim px-3 py-1 text-xs uppercase tracking-wide text-gold-soft">
      {role}
    </span>
  )
}
```

`components/TopBar.tsx`:
```tsx
import { RolePill } from './RolePill'

export function TopBar({ role }: { role?: 'sender' | 'recipient' | 'confirmer' }) {
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-4">
      <span className="font-display text-xl text-paper">Sugarlock</span>
      {role && <RolePill role={role} />}
    </header>
  )
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx tailwind.config.ts components/TopBar.tsx components/RolePill.tsx
git commit -m "feat: wire sugarlock design tokens and app shell"
```

---

## Task 7: Gift creation + funding (Phase 2)

**Files:**
- Create: `app/create/page.tsx`, `app/api/gifts/route.ts`, `app/api/checkout/route.ts`, `app/api/stripe/webhook/route.ts`, `lib/stripe.ts`

- [ ] **Step 1: Stripe client singleton**

`lib/stripe.ts`:
```ts
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
})
```

- [ ] **Step 2: Create-gift API route**

`app/api/gifts/route.ts` — creates a `draft` gift, its `Condition`, and looks up/creates the recipient `User` row by email:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await request.json()
  const { amountCents, recipientEmail, note, conditionType, conditionParams } = body

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be positive' }, { status: 400 })
  }
  if (!['time', 'self', 'third_party', 'data'].includes(conditionType)) {
    return NextResponse.json({ error: 'invalid conditionType' }, { status: 400 })
  }

  const sender = await prisma.user.upsert({
    where: { auth0Id: session.user.sub },
    update: {},
    create: { auth0Id: session.user.sub, email: session.user.email, displayName: session.user.name },
  })

  const recipient = await prisma.user.upsert({
    where: { email: recipientEmail },
    update: {},
    create: { auth0Id: `pending:${recipientEmail}`, email: recipientEmail },
  })

  const gift = await prisma.gift.create({
    data: {
      senderId: sender.id,
      recipientId: recipient.id,
      amountCents,
      note,
      status: 'draft',
      condition: {
        create: {
          type: conditionType,
          params: conditionParams ?? {},
          unlockAt: conditionType === 'time' && conditionParams?.unlockAt ? new Date(conditionParams.unlockAt) : null,
        },
      },
    },
    include: { condition: true },
  })

  return NextResponse.json({ gift })
}
```

- [ ] **Step 3: Checkout session route**

`app/api/checkout/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { giftId } = await request.json()
  const gift = await prisma.gift.findUniqueOrThrow({ where: { id: giftId } })

  if (gift.status !== 'draft') {
    return NextResponse.json({ error: 'gift is not in draft' }, { status: 409 })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Sugarlock gift' },
          unit_amount: gift.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.AUTH0_BASE_URL}/gift/${gift.id}?funded=1`,
    cancel_url: `${process.env.AUTH0_BASE_URL}/create`,
    metadata: { giftId: gift.id },
  })

  await prisma.gift.update({ where: { id: gift.id }, data: { stripeRef: checkoutSession.id } })

  return NextResponse.json({ url: checkoutSession.url })
}
```

- [ ] **Step 4: Webhook — idempotent draft -> funded -> locked**

`app/api/stripe/webhook/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? '', process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch (err) {
    return NextResponse.json({ error: `signature verification failed: ${(err as Error).message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object as { metadata?: { giftId?: string } }
    const giftId = checkoutSession.metadata?.giftId
    if (giftId) {
      const gift = await prisma.gift.findUnique({ where: { id: giftId } })
      if (gift && gift.status === 'draft') {
        await prisma.$transaction([
          prisma.gift.update({ where: { id: giftId }, data: { status: 'locked' } }),
          prisma.ledgerEntry.create({ data: { giftId, event: 'funded', amountCents: gift.amountCents } }),
        ])
      }
    }
  }

  return NextResponse.json({ received: true })
}
```

Note: per `docs/STRIPE_SETUP.md` the funded->locked collapse happens in one step here (funded is recorded as a ledger event, status goes straight to locked) since there's no separate user-facing "funded" screen in the 5-screen prototype — this matches "on successful payment... move gift to funded... then to locked" as an atomic transition.

- [ ] **Step 5: Create page (form -> POST /api/gifts -> POST /api/checkout -> redirect)**

`app/create/page.tsx` — client component implementing the "create" screen from `design/ui-prototype.html`: amount, recipient email, note, condition type selector (time date picker / third_party confirmer email+label), submit button labeled "Fund & seal" per `design/design-tokens.md` voice guidance. On submit: `POST /api/gifts`, then `POST /api/checkout` with the returned `gift.id`, then `window.location.href = url` from the checkout response.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add lib/stripe.ts app/create app/api/gifts app/api/checkout app/api/stripe
git commit -m "feat: gift creation form and Stripe Checkout funding flow"
```

---

## Task 8: Gift detail, confirmer flow, withdraw (Phases 1/3/4 UI)

**Files:**
- Create: `app/page.tsx`, `app/gift/[id]/page.tsx`, `app/api/gifts/[id]/route.ts`, `app/api/gifts/[id]/withdraw/route.ts`, `app/confirm/[token]/page.tsx`, `app/api/confirm/[token]/route.ts`, `components/GiftVessel.tsx`, `components/GiftCard.tsx`

- [ ] **Step 1: Amount-gated gift detail API**

`app/api/gifts/[id]/route.ts` — per `docs/DATA_MODEL.md` note "Confirmer sees... never select amountCents": this route is only reachable by sender/recipient (guarded by middleware + session check), so it's safe to select full gift including `amountCents`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { roleForGift } from '@/lib/roles'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth0.getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { auth0Id: session.user.sub } })
  const gift = await prisma.gift.findUnique({
    where: { id: params.id },
    include: { condition: true, sender: true, recipient: true },
  })
  if (!gift || !user) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const role = roleForGift(user.id, gift)
  if (role === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  return NextResponse.json({ gift, role })
}
```

- [ ] **Step 2: Withdraw route — unlocked -> released only**

`app/api/gifts/[id]/withdraw/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth0.getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const user = await prisma.user.findUniqueOrThrow({ where: { auth0Id: session.user.sub } })
  const gift = await prisma.gift.findUniqueOrThrow({ where: { id: params.id } })

  if (gift.recipientId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (gift.status !== 'unlocked') return NextResponse.json({ error: 'gift is not unlocked' }, { status: 409 })

  await prisma.$transaction([
    prisma.gift.update({ where: { id: gift.id }, data: { status: 'released' } }),
    prisma.ledgerEntry.create({ data: { giftId: gift.id, event: 'released', amountCents: gift.amountCents } }),
  ])

  return NextResponse.json({ status: 'released' })
}
```

- [ ] **Step 3: Confirmer API — amount-free by construction**

`app/api/confirm/[token]/route.ts` — GET validates the token and returns only `{ conditionId, giftNote, recipientDisplayName, decision }` (no `amountCents` in the select); POST records the decision:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyConfirmToken } from '@/lib/confirm-token'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const { conditionId } = await verifyConfirmToken(params.token)
  const condition = await prisma.condition.findUniqueOrThrow({
    where: { id: conditionId },
    include: { gift: { include: { recipient: true } }, confirmations: true },
  })
  return NextResponse.json({
    conditionId,
    note: condition.gift.note,
    recipientDisplayName: condition.gift.recipient.displayName ?? condition.gift.recipient.email,
    decision: condition.confirmations[0]?.decision ?? 'pending',
  })
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const session = await auth0.getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { conditionId } = await verifyConfirmToken(params.token)
  const { decision } = await request.json()
  if (!['approved', 'declined'].includes(decision)) {
    return NextResponse.json({ error: 'invalid decision' }, { status: 400 })
  }

  const confirmer = await prisma.user.upsert({
    where: { auth0Id: session.user.sub },
    update: {},
    create: { auth0Id: session.user.sub, email: session.user.email, displayName: session.user.name },
  })

  await prisma.confirmation.upsert({
    where: { conditionId },
    update: { decision, decidedAt: new Date(), confirmerId: confirmer.id },
    create: { conditionId, confirmerId: confirmer.id, decision, decidedAt: new Date() },
  })

  return NextResponse.json({ decision })
}
```

This upsert-by-conditionId requires `conditionId` to be unique on `Confirmation` for a single-confirmer condition; since `docs/DATA_MODEL.md` says "Condition awaits many Confirmations (usually one)," add a follow-up note in the PR description rather than changing the shared schema — for the hackathon's one-confirmer-per-condition flow, `findFirst`+`create`/`update` is an equally valid alternative if `upsert` on a non-unique column errors at typecheck; use whichever the generated Prisma client accepts.

- [ ] **Step 4: GiftVessel animation component**

`components/GiftVessel.tsx` — Framer Motion component implementing `design/design-tokens.md` Motion section: locked state does a slow 3.5s scale "breathe" loop in gold; on `status === 'unlocked'` it plays one orchestrated burst (scale + color gold->teal) and respects `prefers-reduced-motion` via Framer Motion's `useReducedMotion` hook:
```tsx
'use client'
import { motion, useReducedMotion } from 'framer-motion'

export function GiftVessel({ status }: { status: 'locked' | 'unlocked' | 'released' }) {
  const reduceMotion = useReducedMotion()
  const isUnlocked = status !== 'locked'

  return (
    <motion.div
      className="mx-auto h-32 w-32 rounded-full"
      animate={{
        backgroundColor: isUnlocked ? '#4ca894' : '#d9a441',
        scale: reduceMotion ? 1 : isUnlocked ? [1, 1.15, 1] : [1, 1.04, 1],
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : isUnlocked
            ? { duration: 0.6, ease: 'easeOut' }
            : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
      }
    />
  )
}
```

- [ ] **Step 5: Gift detail page**

`app/gift/[id]/page.tsx` — client component: fetches `GET /api/gifts/[id]`, renders `<GiftVessel>`, amount in Fraunces at large size, note, condition summary, the locked-state copy "You can see it. You can't touch it yet." when `status === 'locked'`, and a "Withdraw $X.XX" button calling `POST /api/gifts/[id]/withdraw` when `status === 'unlocked'` and the viewer's role is `recipient`.

- [ ] **Step 6: Confirm page**

`app/confirm/[token]/page.tsx` — client component: fetches `GET /api/confirm/[token]`, renders only the yes/no question + note + recipient name (never an amount — matches the API's amount-free response), buttons `POST /api/confirm/[token]` with `approved`/`declined`.

- [ ] **Step 7: Home page**

`app/page.tsx` — lists the signed-in user's gifts split into "sent" and "received" (`GiftCard` per gift, using `roleForGift` to badge each), with a "Create a gift" CTA linking to `/create`.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx app/gift app/confirm app/api/gifts app/api/confirm components/GiftVessel.tsx components/GiftCard.tsx
git commit -m "feat: gift detail, confirmer flow, withdraw, and unlock reveal"
```

---

## Task 9: Unlock engine runner endpoint + Vercel Cron

**Files:**
- Create: `app/api/cron/unlock/route.ts`, `vercel.json`

- [ ] **Step 1: Cron-triggered route**

`app/api/cron/unlock/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { runUnlockEngine } from '@/lib/unlock-engine'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runUnlockEngine()
  return NextResponse.json(result)
}
```

- [ ] **Step 2: Vercel Cron config**

`vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/unlock", "schedule": "*/5 * * * *" }]
}
```

- [ ] **Step 3: Poll-on-load fallback for the demo**

In `app/gift/[id]/page.tsx` (from Task 8), add a `useEffect` that calls `fetch('/api/cron/unlock')` once on mount when `status === 'locked'`, then re-fetches the gift — this is the "poll-on-load fallback is fine for the demo" path from `docs/TECHNICAL_ARCHITECTURE.md`. Guard it: only fire this client-side poll if `CRON_SECRET` is unset (dev/demo), matching the header check in Step 1.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron vercel.json app/gift
git commit -m "feat: unlock engine cron endpoint with poll-on-load demo fallback"
```

---

## Task 10: README + env docs cleanup

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the handoff-package README with a real project README**

Cover: what the app is (one paragraph from `BUILD_PLAN.md` section 1), setup (`npm install`, `npx prisma migrate dev`, copy `.env.example` to `.env.local` and fill Auth0/Stripe/DB values, `npm run dev`), the Stripe Leaderboard code `auth0-sanfrancisco-2026` reminder, and a link back to `BUILD_PLAN.md` for the full phase breakdown. Keep `docs/`, `design/`, `diagrams/` references intact since those are the original spec files.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: replace handoff README with project setup instructions"
```

---

## Task 11: Push to GitHub

**Files:** none (repo operations only)

- [ ] **Step 1: Confirm .gitignore excludes secrets and build output**

Verify `.gitignore` (from `create-next-app`, Task 1) includes `.env*.local`, `node_modules`, `.next`. Add `.env.local` explicitly if not already covered.

- [ ] **Step 2: Review what will be pushed**

Run: `git log --oneline` and `git status`
Expected: clean tree, all commits from Tasks 1-10 present, no `.env.local` or `node_modules` tracked.

- [ ] **Step 3: Add remote and push**

```bash
git remote add origin https://github.com/techadnank9/sugarlock.git
git branch -M main
git push -u origin main
```

If the remote already has commits (repo pre-created with a README/license on GitHub), do NOT force push — fetch first and report the conflict for the user to resolve, since rewriting a remote history the user didn't ask to discard is exactly the kind of destructive action to avoid.

- [ ] **Step 4: Report the pushed URL back to the user.**

---

## Self-review notes

- **Spec coverage:** All 4 BUILD_PLAN phases map to tasks 5-9 (Phase 1: Task 5+6, Phase 2: Task 7, Phase 3: Task 3+9, Phase 4: Task 8 GiftVessel+withdraw). Data model = Task 2. Auth0 confirmer scoping (Option A) = Task 4+8. Stripe leaderboard requirement = called out in Task 10 README. Cut list is not a task — it's a fallback instruction for the executor if time runs out, left as-is in BUILD_PLAN.md.
- **No live integration test:** flagged up top and repeated at Task 1 — this environment cannot obtain real Auth0/Stripe/Postgres credentials, so "demo checkpoint" callouts from BUILD_PLAN.md phases are NOT independently verified end-to-end here. `npm run build` + unit tests on `evaluateCondition`/confirm-token are the verification bar. Tell the user this explicitly when the plan finishes.
- **Auth0 SDK API surface risk:** `@auth0/nextjs-auth0`'s App Router API has changed across major versions. Task 5 Step 2 has an explicit instruction to check the installed version's actual exports rather than assume `handleAuth`/`Auth0Client` are correct — treat that as a live decision point during execution, not a placeholder.
