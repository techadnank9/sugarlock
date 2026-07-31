# Gift-Shipping Scheduler Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the money-escrow unlock app with the gift-shipping-scheduler product described in `docs/superpowers/specs/2026-07-30-gift-scheduler-pivot-design.md`.

**Architecture:** Fresh Prisma schema (`User` + `ScheduledGift`, no more `Condition`/`Confirmation`/`LedgerEntry`); a pure `evaluateGiftStatus` status engine analogous to the old unlock-engine; CRUD API routes under `/api/gifts`; two ported UI surfaces — a marketing landing page (logged out) and a calendar app (logged in) — sharing the existing `getAppSession`/guest-login auth.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + Postgres, Vitest, CSS Modules (no Tailwind for the ported surfaces), Leaflet for address maps, existing `@auth0/nextjs-auth0` v4 + guest-session cookie auth (untouched).

---

## Task 1: Prisma schema — replace the money-escrow model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace the schema contents**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name gift_scheduler_pivot`
Expected: Prisma reports dropping `Confirmation`, `LedgerEntry`, `Condition`, `Gift` and creating `ScheduledGift`, ending with "Your database is now in sync with your schema."

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: replace money-escrow schema with ScheduledGift model"
```

---

## Task 2: `lib/order-engine.ts` — status engine (TDD)

**Files:**
- Create: `lib/order-engine.ts`
- Test: `test/order-engine.test.ts`
- Delete (later, Task 6): `lib/unlock-engine.ts`, `test/unlock-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { evaluateGiftStatus } from '../lib/order-engine'

describe('evaluateGiftStatus', () => {
  const eventDate = new Date('2026-03-12T00:00:00Z')

  it('stays scheduled when today is before the grace window', () => {
    const today = new Date('2026-03-01T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'scheduled' }, today)).toBe('scheduled')
  })

  it('moves to ordered once today enters the grace window', () => {
    const today = new Date('2026-03-09T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'scheduled' }, today)).toBe('ordered')
  })

  it('moves to delivered on the event day', () => {
    const today = new Date('2026-03-12T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'ordered' }, today)).toBe('delivered')
  })

  it('moves to delivered after the event day even if it skipped ordered', () => {
    const today = new Date('2026-03-15T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'scheduled' }, today)).toBe('delivered')
  })

  it('never regresses an already-delivered gift', () => {
    const today = new Date('2026-01-01T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'delivered' }, today)).toBe('delivered')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/order-engine.test.ts`
Expected: FAIL — `Cannot find module '../lib/order-engine'`

- [ ] **Step 3: Write the implementation**

```ts
import { prisma } from './prisma'

export type GiftStatus = 'scheduled' | 'ordered' | 'delivered'

export type GiftStatusInput = {
  eventDate: Date
  graceDays: number
  status: GiftStatus
}

export function evaluateGiftStatus(gift: GiftStatusInput, today: Date): GiftStatus {
  if (gift.status === 'delivered') return 'delivered'
  if (today >= gift.eventDate) return 'delivered'

  const graceStart = new Date(gift.eventDate)
  graceStart.setDate(graceStart.getDate() - gift.graceDays)
  if (today >= graceStart) return 'ordered'

  return gift.status
}

export async function runOrderEngine(): Promise<{ checked: number; updated: string[] }> {
  const gifts = await prisma.scheduledGift.findMany({ where: { status: { not: 'delivered' } } })
  const today = new Date()
  const updated: string[] = []

  for (const gift of gifts) {
    const next = evaluateGiftStatus(gift, today)
    if (next !== gift.status) {
      await prisma.scheduledGift.update({ where: { id: gift.id }, data: { status: next } })
      updated.push(gift.id)
    }
  }

  return { checked: gifts.length, updated }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/order-engine.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/order-engine.ts test/order-engine.test.ts
git commit -m "feat: add evaluateGiftStatus status engine"
```

---

## Task 3: `lib/catalog.ts` — mocked product catalog (TDD)

**Files:**
- Create: `lib/catalog.ts`
- Test: `test/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { searchCatalog } from '../lib/catalog'

describe('searchCatalog', () => {
  it('matches by tag or name, case-insensitively', () => {
    const results = searchCatalog('headphones', null)
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.every((item) => item.tags.includes('headphones') || item.name.toLowerCase().includes('headphones')),
    ).toBe(true)
  })

  it('filters by budget', () => {
    const results = searchCatalog('', 20)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((item) => item.price <= 20)).toBe(true)
  })

  it('falls back to closest-priced items when a query has no direct match but a budget is set', () => {
    const results = searchCatalog('nonexistentwidget', 15)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((item) => item.price <= 15)).toBe(true)
  })

  it('returns nothing when query and budget both match nothing', () => {
    const results = searchCatalog('nonexistentwidget', 0)
    expect(results).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/catalog.test.ts`
Expected: FAIL — `Cannot find module '../lib/catalog'`

- [ ] **Step 3: Write the implementation**

```ts
export type CatalogItem = {
  icon: string
  name: string
  price: number
  store: string
  tags: string[]
}

export const CATALOG: CatalogItem[] = [
  { icon: '🎧', name: 'Echo Buds 2nd Gen', price: 39, store: 'Amazon', tags: ['headphones', 'earbuds', 'audio'] },
  { icon: '🎧', name: 'onn. Wireless Headphones', price: 24, store: 'Walmart', tags: ['headphones', 'audio'] },
  { icon: '🎧', name: 'heyday Bluetooth Earbuds', price: 29, store: 'Target', tags: ['headphones', 'earbuds', 'audio'] },
  { icon: '🎧', name: 'Sony WH-CH520', price: 59, store: 'Best Buy', tags: ['headphones', 'audio', 'music'] },
  { icon: '🎧', name: 'Summit Studio Headphones', price: 159, store: 'Amazon', tags: ['headphones', 'audio', 'music'] },
  { icon: '⌚', name: 'Fossil Minimalist Watch', price: 95, store: 'Amazon', tags: ['watch', 'jewelry', 'accessory'] },
  { icon: '⌚', name: 'Time and Tru Dress Watch', price: 22, store: 'Walmart', tags: ['watch', 'accessory'] },
  { icon: '⌚', name: 'Wild Fable Woven Watch', price: 18, store: 'Target', tags: ['watch', 'accessory'] },
  { icon: '⌚', name: 'Engraved Steel Watch', price: 68, store: 'Etsy', tags: ['watch', 'jewelry', 'personalized'] },
  { icon: '🕯️', name: 'Amber & Oak Candle Set', price: 28, store: 'Etsy', tags: ['candle', 'home', 'cozy'] },
  { icon: '🕯️', name: 'Threshold Soy Candle 3-Pack', price: 15, store: 'Target', tags: ['candle', 'home'] },
  { icon: '🕯️', name: 'Better Homes Candle Jar', price: 9, store: 'Walmart', tags: ['candle', 'home'] },
  { icon: '🕯️', name: 'Yankee Candle Gift Set', price: 32, store: 'Amazon', tags: ['candle', 'home', 'cozy'] },
  { icon: '📖', name: 'Leather Travel Journal', price: 22, store: 'Etsy', tags: ['book', 'journal', 'writing'] },
  { icon: '📖', name: 'Moleskine Classic Notebook', price: 19, store: 'Amazon', tags: ['book', 'journal', 'writing'] },
  { icon: '📖', name: 'Sun Squad Sketch Journal', price: 8, store: 'Target', tags: ['book', 'journal'] },
  { icon: '🪴', name: 'Potted Fiddle Leaf Fig', price: 34, store: 'Etsy', tags: ['plant', 'home', 'green'] },
  { icon: '🪴', name: 'Costa Farms Snake Plant', price: 19, store: 'Walmart', tags: ['plant', 'home', 'green'] },
  { icon: '🪴', name: 'Succulent Trio, Ceramic Pots', price: 26, store: 'Target', tags: ['plant', 'home', 'green'] },
  { icon: '🔊', name: 'Roam Bluetooth Speaker', price: 65, store: 'Amazon', tags: ['speaker', 'audio', 'music'] },
  { icon: '🔊', name: 'JBL Clip 4 Speaker', price: 49, store: 'Best Buy', tags: ['speaker', 'audio', 'music'] },
  { icon: '🔊', name: 'onn. Portable Speaker', price: 20, store: 'Walmart', tags: ['speaker', 'audio'] },
  { icon: '🧣', name: 'Woven Wool Scarf', price: 31, store: 'Etsy', tags: ['scarf', 'clothing', 'warm'] },
  { icon: '🧣', name: 'A New Day Knit Scarf', price: 15, store: 'Target', tags: ['scarf', 'clothing', 'warm'] },
  { icon: '🧣', name: 'Time and Tru Plaid Scarf', price: 12, store: 'Walmart', tags: ['scarf', 'clothing', 'warm'] },
  { icon: '🍫', name: 'Artisan Chocolate Box', price: 18, store: 'Etsy', tags: ['chocolate', 'sweet', 'food'] },
  { icon: '🍫', name: 'Ghirardelli Gift Tin', price: 14, store: 'Walmart', tags: ['chocolate', 'sweet', 'food'] },
  { icon: '🍫', name: 'Godiva Assorted Box', price: 25, store: 'Target', tags: ['chocolate', 'sweet', 'food'] },
  { icon: '☕', name: 'Nomad Ceramic Mug Set', price: 24, store: 'Etsy', tags: ['mug', 'coffee', 'home'] },
  { icon: '☕', name: 'Threshold Stoneware Mug', price: 7, store: 'Target', tags: ['mug', 'coffee', 'home'] },
  { icon: '☕', name: 'Better Homes Mug 2-Pack', price: 10, store: 'Walmart', tags: ['mug', 'coffee', 'home'] },
  { icon: '🧴', name: 'Calm Aromatherapy Set', price: 42, store: 'Etsy', tags: ['candle', 'spa', 'relax'] },
  { icon: '🧴', name: 'Bath & Body Gift Set', price: 22, store: 'Target', tags: ['spa', 'relax'] },
  { icon: '🧴', name: 'Equate Spa Gift Basket', price: 16, store: 'Walmart', tags: ['spa', 'relax'] },
]

export const STORE_COLORS: Record<string, string> = {
  Amazon: '#FF9900',
  Walmart: '#0071CE',
  Target: '#CC0000',
  'Best Buy': '#0A4FA0',
  Etsy: '#F1641E',
}

export function searchCatalog(query: string, budget: number | null): CatalogItem[] {
  const q = query.trim().toLowerCase()

  let results = CATALOG.filter((item) => {
    const matchesQuery = !q || item.tags.some((t) => t.includes(q)) || item.name.toLowerCase().includes(q)
    const matchesBudget = budget === null || item.price <= budget
    return matchesQuery && matchesBudget
  })

  if (q && results.length === 0 && budget !== null) {
    results = CATALOG.filter((item) => item.price <= budget).slice(0, 4)
  }

  return results
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/catalog.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/catalog.ts test/catalog.test.ts
git commit -m "feat: add mocked product catalog and search"
```

---

## Task 4: `lib/geocode.ts` — address simplification + Nominatim fetch (TDD)

**Files:**
- Create: `lib/geocode.ts`
- Test: `test/geocode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { simplifyAddress } from '../lib/geocode'

describe('simplifyAddress', () => {
  it('strips floor tokens', () => {
    expect(simplifyAddress('100 1st St 6th floor, San Francisco, CA 94105')).toBe(
      '100 1st St, San Francisco, CA 94105',
    )
  })

  it('strips suite/apt/unit tokens', () => {
    expect(simplifyAddress('500 Main St, Apt 4B, Austin, TX 78701')).toBe('500 Main St, Austin, TX 78701')
  })

  it('strips a bare # unit marker', () => {
    expect(simplifyAddress('12 Elm St #3, Portland, OR 97201')).toBe('12 Elm St, Portland, OR 97201')
  })

  it('leaves an address with no unit info unchanged', () => {
    expect(simplifyAddress('1 Infinite Loop, Cupertino, CA 95014')).toBe('1 Infinite Loop, Cupertino, CA 95014')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/geocode.test.ts`
Expected: FAIL — `Cannot find module '../lib/geocode'`

- [ ] **Step 3: Write the implementation**

```ts
// Strips unit/floor/suite/apt tokens that trip up free-form geocoding, e.g.
// "100 1st St 6th floor, San Francisco, CA 94105" -> "100 1st St, San Francisco, CA 94105"
export function simplifyAddress(address: string): string {
  return address
    .replace(/,?\s*\b\d+(st|nd|rd|th)?\s+floor\b/gi, '')
    .replace(/,?\s*\bfloor\s*#?\d+\b/gi, '')
    .replace(/,?\s*\b(suite|ste\.?|apt\.?|apartment|unit)\s*#?\s*\w+\b/gi, '')
    .replace(/,?\s*#\s*\w+/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*,/g, ',')
    .trim()
}

export type GeocodeResult = { lat: number; lng: number }

async function queryNominatim(query: string): Promise<Array<{ lat: string; lon: string }>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`,
  )
  if (!res.ok) throw new Error('geocode request failed')
  return res.json()
}

export async function fetchGeocode(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (trimmed.length < 6) return null

  const direct = await queryNominatim(trimmed)
  if (direct.length > 0) return { lat: parseFloat(direct[0].lat), lng: parseFloat(direct[0].lon) }

  const simplified = simplifyAddress(trimmed)
  if (simplified && simplified !== trimmed) {
    const fallback = await queryNominatim(simplified)
    if (fallback.length > 0) return { lat: parseFloat(fallback[0].lat), lng: parseFloat(fallback[0].lon) }
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/geocode.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/geocode.ts test/geocode.test.ts
git commit -m "feat: add address simplification and Nominatim geocode wrapper"
```

---

## Task 5: Trim `lib/users.ts`

**Files:**
- Modify: `lib/users.ts`

- [ ] **Step 1: Remove `upsertPendingUser`, keep `upsertUserForSession`**

Replace the full file contents with:

```ts
import { prisma } from './prisma'

type Auth0SessionUser = {
  sub: string
  email?: string | null
  name?: string | null
}

/** Upserts by email. Recipients are plain fields on ScheduledGift now (no
 * account of their own), so email only ever identifies the signed-in sender. */
export async function upsertUserForSession(user: Auth0SessionUser) {
  const email = user.email ?? `${user.sub}@unknown.local`
  return prisma.user.upsert({
    where: { email },
    update: { auth0Id: user.sub, displayName: user.name ?? undefined },
    create: { auth0Id: user.sub, email, displayName: user.name },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/users.ts
git commit -m "chore: drop upsertPendingUser, no longer needed without recipient accounts"
```

---

## Task 6: Remove the money-escrow app's routes, pages, libs, components, tests, deps

**Files:**
- Delete: `app/create/`, `app/gift/`, `app/confirm/`, `app/api/confirm/`, `app/api/checkout/`, `app/api/stripe/`, `app/api/gifts/[id]/withdraw/`, `app/api/gifts/[id]/confirm-funding/`
- Delete: `lib/confirm-token.ts`, `lib/roles.ts`, `lib/stripe.ts`, `lib/unlock-engine.ts`
- Delete: `components/GiftCard.tsx`, `components/GiftVessel.tsx`, `components/RolePill.tsx`, `components/TopBar.tsx`
- Delete: `test/confirm-token.test.ts`, `test/unlock-engine.test.ts`
- Modify: `package.json`, `.env.example`, `vercel.json`

- [ ] **Step 1: Delete the old routes and pages**

```bash
rm -rf app/create app/gift app/confirm app/api/confirm app/api/checkout app/api/stripe \
  "app/api/gifts/[id]/withdraw" "app/api/gifts/[id]/confirm-funding"
```

- [ ] **Step 2: Delete the old libs, components, tests**

```bash
rm lib/confirm-token.ts lib/roles.ts lib/stripe.ts lib/unlock-engine.ts
rm components/GiftCard.tsx components/GiftVessel.tsx components/RolePill.tsx components/TopBar.tsx
rm test/confirm-token.test.ts test/unlock-engine.test.ts
```

- [ ] **Step 3: Remove dead dependencies from `package.json`**

Remove these three lines from `"dependencies"`: `"@stripe/stripe-js"`, `"framer-motion"`, `"stripe"`.

Add to `"dependencies"`: `"leaflet": "^1.9.4"`
Add to `"devDependencies"`: `"@types/leaflet": "^1.9.14"`

- [ ] **Step 4: Run install**

Run: `npm install`
Expected: lockfile updates, no errors.

- [ ] **Step 5: Remove Stripe env vars from `.env.example`**

Delete the `# Stripe` section (four `STRIPE_*` lines) and the `# Stripe leaderboard code` comment line. Keep `DATABASE_URL`, the Auth0 block, `CONFIRM_TOKEN_SECRET`, and `# Cron` / `CRON_SECRET`.

- [ ] **Step 6: Update `vercel.json`**

```json
{
  "crons": [{ "path": "/api/cron/order-check", "schedule": "*/5 * * * *" }]
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove money-escrow routes, pages, libs, components, and dead deps"
```

---

## Task 7: `app/api/gifts/route.ts` — list + create

**Files:**
- Create: `app/api/gifts/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const user = await upsertUserForSession(session.user)
  const gifts = await prisma.scheduledGift.findMany({
    where: { userId: user.id },
    orderBy: { eventDate: 'asc' },
  })
  return NextResponse.json({ gifts })
}

export async function POST(request: NextRequest) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await request.json()
  const { recipientName, address, lat, lng, occasion, eventDate, graceDays, colorHex, product } = body

  if (!recipientName || typeof recipientName !== 'string') {
    return NextResponse.json({ error: 'recipientName is required' }, { status: 400 })
  }
  if (!eventDate) {
    return NextResponse.json({ error: 'eventDate is required' }, { status: 400 })
  }

  const user = await upsertUserForSession(session.user)
  const gift = await prisma.scheduledGift.create({
    data: {
      userId: user.id,
      recipientName,
      address: address ?? '',
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      occasion: occasion ?? null,
      eventDate: new Date(eventDate),
      graceDays: typeof graceDays === 'number' ? graceDays : 4,
      colorHex: colorHex ?? '#F4511E',
      productIcon: product?.icon ?? null,
      productName: product?.name ?? null,
      productPriceCents: typeof product?.price === 'number' ? Math.round(product.price * 100) : null,
      productStore: product?.store ?? null,
    },
  })
  return NextResponse.json({ gift })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/gifts/route.ts
git commit -m "feat: add GET/POST /api/gifts"
```

---

## Task 8: `app/api/gifts/[id]/route.ts` — edit

**Files:**
- Create: `app/api/gifts/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const user = await upsertUserForSession(session.user)
  const existing = await prisma.scheduledGift.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.userId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json()
  const { recipientName, address, lat, lng, occasion, eventDate, graceDays, colorHex, product } = body

  const gift = await prisma.scheduledGift.update({
    where: { id },
    data: {
      recipientName: recipientName ?? existing.recipientName,
      address: address ?? existing.address,
      lat: typeof lat === 'number' ? lat : existing.lat,
      lng: typeof lng === 'number' ? lng : existing.lng,
      occasion: occasion ?? existing.occasion,
      eventDate: eventDate ? new Date(eventDate) : existing.eventDate,
      graceDays: typeof graceDays === 'number' ? graceDays : existing.graceDays,
      colorHex: colorHex ?? existing.colorHex,
      productIcon: product ? (product.icon ?? null) : existing.productIcon,
      productName: product ? (product.name ?? null) : existing.productName,
      productPriceCents: product
        ? typeof product.price === 'number'
          ? Math.round(product.price * 100)
          : null
        : existing.productPriceCents,
      productStore: product ? (product.store ?? null) : existing.productStore,
    },
  })
  return NextResponse.json({ gift })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add "app/api/gifts/[id]/route.ts"
git commit -m "feat: add PATCH /api/gifts/[id]"
```

---

## Task 9: `app/api/cron/order-check/route.ts` — replaces `/api/cron/unlock`

**Files:**
- Create: `app/api/cron/order-check/route.ts`
- Delete: `app/api/cron/unlock/route.ts` (superseded by this)

- [ ] **Step 1: Delete the old cron route**

```bash
rm -rf app/api/cron/unlock
```

- [ ] **Step 2: Write the new route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { runOrderEngine } from '@/lib/order-engine'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runOrderEngine()
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add /api/cron/order-check, remove /api/cron/unlock"
```

---

## Task 10: Design tokens + fonts

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

Merges the landing/calendar mockups' palettes into one token set. `--rose`/`--raspberry` and sage were already the same colors across both mockups; `--line` is kept as two variants (`--line` warm, for the blush marketing surface; `--line-neutral`, for the paper app surface) since the two mockups use genuinely different border tones for their genuinely different backgrounds.

- [ ] **Step 1: Replace `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --blush: #FFF5F7;
  --bg: #fafaf9;
  --panel: #ffffff;
  --line: #F0DEE3;
  --line-neutral: #e6e4df;
  --ink: #241620;
  --ink-soft: #6B5866;
  --ink-faint: #A796A1;
  --rose: #C8385F;
  --rose-deep: #8A1F3D;
  --rose-tint: #FCE7EC;
  --sage: #4F7A57;
  --sage-tint: #E8F0E7;
  --gold: #E8A33D;
  --gold-tint: #FDF1DE;

  --radius-card: 18px;
  --radius-control: 14px;
}

@theme inline {
  --color-blush: var(--blush);
  --color-bg: var(--bg);
  --color-panel: var(--panel);
  --color-line: var(--line);
  --color-line-neutral: var(--line-neutral);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-ink-faint: var(--ink-faint);
  --color-rose: var(--rose);
  --color-rose-deep: var(--rose-deep);
  --color-rose-tint: var(--rose-tint);
  --color-sage: var(--sage);
  --color-sage-tint: var(--sage-tint);
  --color-gold: var(--gold);
  --color-gold-tint: var(--gold-tint);

  --font-display: var(--font-fraunces);
  --font-space: var(--font-space-grotesk);
  --font-body: var(--font-inter);

  --radius-card: var(--radius-card);
  --radius-control: var(--radius-control);
}

html {
  scroll-behavior: smooth;
}

body {
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Fraunces, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sugarlock",
  description: "Gifts that arrive right on time, every time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (existing errors about removed pages, if any remain at this point in the sequence, are expected until Task 19 rewires `app/page.tsx` — but by this point in the plan Task 6 already removed the pages that referenced old components, so there should be none).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: unify design tokens, add Space Grotesk font"
```

---

## Task 11: Landing page

**Files:**
- Create: `components/landing/landing.module.css`
- Create: `components/landing/PricingCard.tsx`
- Create: `components/landing/LandingPage.tsx`

Ported from `design/sugarlock-landing.html`. Convention: every class from the source file is kept exactly as-is (including kebab-case) and referenced via bracket notation, e.g. `styles['nav-links']` — this guarantees 1:1 fidelity with the source with zero renaming risk. Bare-tag selectors from the source (`*`, `body`, `h1,h2,h3`, `a`, `img,svg`, `:focus-visible`) are scoped under a `.page` wrapper using CSS Modules' `:global()` escape, since plain tag selectors are not scoped by CSS Modules and would otherwise leak. `header`/`footer` (originally bare-tag selectors with no class in the source) are converted to `.header`/`.footer` classes instead, applied directly to those JSX elements — simpler than `:global()` for a single occurrence.

- [ ] **Step 1: Write `components/landing/landing.module.css`**

```css
.page :global(*) {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.page {
  min-height: 100vh;
  background: var(--blush);
  color: var(--ink);
  font-family: "Inter", -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.page :global(h1), .page :global(h2), .page :global(h3) {
  font-family: "Fraunces", Georgia, serif;
  letter-spacing: -0.01em;
}
.page :global(a) { color: inherit; text-decoration: none; }
.page :global(img), .page :global(svg) { display: block; max-width: 100%; }
.wrap { max-width: 1160px; margin: 0 auto; padding: 0 32px; }
.page :global(:focus-visible) { outline: 2.5px solid var(--rose); outline-offset: 3px; border-radius: 4px; }

.header {
  position: sticky; top: 0; z-index: 40;
  background: rgba(255,245,247,0.86);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 32px;
  max-width: 1160px; margin: 0 auto;
}
.logo { display: flex; align-items: center; gap: 9px; }
.logo .mark {
  width: 30px; height: 30px; border-radius: 9px;
  background: var(--rose);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-family: "Space Grotesk"; font-weight: 700; font-size: 14px;
}
.logo span { font-family: "Space Grotesk"; font-weight: 700; font-size: 17px; }
.nav-links { display: flex; align-items: center; gap: 30px; }
.nav-links .navlink { font-size: 14px; font-weight: 500; color: var(--ink-soft); }
.nav-links .navlink:hover { color: var(--ink); }
.nav-cta { display: flex; align-items: center; gap: 16px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: 999px; font-weight: 600; font-size: 14px;
  padding: 11px 22px; cursor: pointer; border: 1.5px solid transparent;
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
}
.btn-primary { background: var(--rose); color: #fff; }
.btn-primary:hover { background: var(--rose-deep); transform: translateY(-1px); box-shadow: 0 8px 18px rgba(200,56,95,.28); }
.btn-ghost { background: transparent; color: var(--ink); border-color: var(--line); }
.btn-ghost:hover { background: var(--panel); }
.signin-link { font-size: 14px; font-weight: 600; color: var(--ink); }

.hero {
  padding: 78px 0 60px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center;
}
.eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: "Space Grotesk"; font-size: 12px; font-weight: 600;
  letter-spacing: .07em; text-transform: uppercase; color: var(--rose-deep);
  background: var(--rose-tint); border-radius: 999px; padding: 6px 13px;
  margin-bottom: 22px;
}
.hero h1 { font-size: 52px; line-height: 1.06; font-weight: 600; margin-bottom: 22px; }
.hero h1 em { font-style: normal; color: var(--rose); }
.hero p.sub { font-size: 17px; line-height: 1.6; color: var(--ink-soft); max-width: 440px; margin-bottom: 30px; }
.hero-ctas { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.btn-lg { padding: 14px 26px; font-size: 15px; }
.link-arrow { font-size: 14px; font-weight: 600; color: var(--ink); display: inline-flex; align-items: center; gap: 6px; }
.link-arrow svg { transition: transform .15s ease; }
.link-arrow:hover svg { transform: translateX(3px); }

.trust-line { margin-top: 38px; font-size: 12.5px; color: var(--ink-faint); }
.trust-marks { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
.store-chip {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 999px; padding: 6px 14px 6px 6px;
}
.store-chip .badge {
  width: 22px; height: 22px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-family: "Space Grotesk"; font-weight: 700; font-size: 11px;
  flex-shrink: 0;
}
.store-chip span { font-family: "Space Grotesk"; font-weight: 600; font-size: 13px; color: var(--ink); }
.store-chip.more { background: transparent; border-style: dashed; border-color: var(--ink-faint); }
.store-chip.more span { color: var(--ink-faint); font-weight: 500; }

.daystrip-card {
  background: var(--panel);
  border-radius: 22px;
  border: 1px solid var(--line);
  padding: 26px 24px 22px;
  box-shadow: 0 30px 60px -20px rgba(138,31,61,.18);
}
.daystrip-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.daystrip-head .who { display: flex; align-items: center; gap: 10px; }
.daystrip-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--gold-tint); color: var(--gold);
  display: flex; align-items: center; justify-content: center;
  font-family: "Space Grotesk"; font-weight: 700; font-size: 13px;
}
.daystrip-head .who div { font-size: 13px; font-weight: 700; }
.daystrip-head .who small { display: block; font-size: 11.5px; color: var(--ink-faint); font-weight: 500; }
.daystrip-status {
  font-size: 11px; font-weight: 700; color: var(--sage);
  background: var(--sage-tint); border-radius: 999px; padding: 4px 10px;
}

.strip-track { position: relative; display: flex; gap: 6px; padding-top: 26px; }
.strip-day {
  flex: 1; height: 56px; border-radius: 9px;
  background: #FAF7F8; border: 1px solid var(--line);
  display: flex; align-items: flex-end; justify-content: center;
  font-family: "Space Grotesk"; font-size: 10.5px; font-weight: 600; color: var(--ink-faint);
  padding-bottom: 5px; position: relative;
}
.strip-day.grace { background: var(--sage-tint); border-color: #cfe3cf; color: var(--sage); }
.strip-day.eventday { background: var(--rose); border-color: var(--rose); color: #fff; }
.strip-day.eventday .pin { position: absolute; top: -24px; left: 50%; transform: translateX(-50%); font-size: 16px; }
.strip-caption { display: flex; justify-content: space-between; margin-top: 14px; font-size: 11.5px; color: var(--ink-faint); }
.strip-caption b { color: var(--sage); font-weight: 700; }
.strip-caption .arrive { color: var(--rose-deep); font-weight: 700; }

.gift-glider { position: absolute; top: -4px; left: 0; font-size: 20px; animation: glide 3.6s ease-in-out infinite; }
@keyframes glide {
  0% { left: 2%; opacity: 0; }
  8% { opacity: 1; }
  82% { left: 88%; opacity: 1; }
  92% { opacity: 0; }
  100% { left: 88%; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .gift-glider { animation: none; left: 80%; }
}

.section { padding: 88px 0; }
.section-head { max-width: 560px; margin-bottom: 52px; }
.section-eyebrow {
  font-family: "Space Grotesk"; font-size: 12px; font-weight: 600;
  letter-spacing: .07em; text-transform: uppercase; color: var(--rose);
  margin-bottom: 12px; display: block;
}
.section-head h2 { font-size: 34px; font-weight: 600; line-height: 1.15; margin-bottom: 14px; }
.section-head p { color: var(--ink-soft); font-size: 15.5px; line-height: 1.6; }

.steps { display: grid; grid-template-columns: repeat(3,1fr); gap: 28px; }
.step { position: relative; padding-top: 8px; }
.step .stepnum { font-family: "Fraunces"; font-size: 15px; font-weight: 600; color: var(--rose); margin-bottom: 14px; display: block; }
.step h3 { font-size: 19px; font-weight: 600; margin-bottom: 10px; }
.step p { font-size: 14px; line-height: 1.65; color: var(--ink-soft); }
.step-rule { height: 1px; background: var(--line); margin: 0 0 22px; }

.features { display: grid; grid-template-columns: repeat(4,1fr); gap: 18px; }
.feature-card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 24px 20px; }
.feature-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 17px; margin-bottom: 16px; }
.feature-card h3 { font-size: 15px; font-weight: 700; margin-bottom: 7px; font-family: "Inter"; }
.feature-card p { font-size: 13px; line-height: 1.55; color: var(--ink-soft); }

.quote-band {
  background: var(--ink); color: var(--blush);
  border-radius: 26px; padding: 64px 56px;
  display: grid; grid-template-columns: auto 1fr; gap: 36px; align-items: center;
}
.quote-mark { font-family: "Fraunces"; font-size: 80px; line-height: .6; color: var(--rose); font-weight: 600; }
.quote-band blockquote { font-family: "Fraunces"; font-size: 24px; font-weight: 500; line-height: 1.45; margin-bottom: 18px; }
.quote-band .attribution { font-size: 13.5px; color: #D8B9C4; font-weight: 500; }
.quote-band .attribution b { color: var(--blush); }

.pricing-card {
  max-width: 460px; margin: 0 auto;
  background: var(--panel); border: 1.5px solid var(--rose); border-radius: 22px;
  padding: 36px 34px; text-align: center;
  box-shadow: 0 30px 60px -24px rgba(200,56,95,.24);
}
.pricing-card .plan-name { font-family: "Space Grotesk"; font-weight: 700; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--rose); margin-bottom: 14px; }
.pricing-card .price { font-family: "Fraunces"; font-size: 48px; font-weight: 600; margin-bottom: 4px; }
.pricing-card .price span { font-size: 16px; font-weight: 500; color: var(--ink-soft); }
.pricing-card .price-note { font-size: 13px; color: var(--ink-faint); margin-bottom: 26px; }

.billing-toggle { display: inline-flex; align-items: center; gap: 4px; background: var(--rose-tint); border-radius: 999px; padding: 4px; margin-bottom: 26px; }
.billing-toggle button { border: none; background: transparent; cursor: pointer; font-family: "Inter"; font-size: 13px; font-weight: 600; color: var(--rose-deep); padding: 8px 18px; border-radius: 999px; display: flex; align-items: center; gap: 6px; }
.billing-toggle button.active { background: var(--rose); color: #fff; }
.billing-toggle .save-tag { font-size: 10px; font-weight: 700; color: var(--sage); background: var(--sage-tint); border-radius: 999px; padding: 2px 7px; }
.billing-toggle button.active .save-tag { background: rgba(255,255,255,.22); color: #fff; }
.pricing-list { list-style: none; text-align: left; margin-bottom: 30px; display: flex; flex-direction: column; gap: 11px; }
.pricing-list li { font-size: 14px; color: var(--ink); display: flex; gap: 10px; align-items: flex-start; }
.pricing-list li .check { color: var(--sage); font-weight: 700; flex-shrink: 0; }

.final-cta { background: linear-gradient(135deg, var(--rose) 0%, var(--rose-deep) 100%); border-radius: 26px; padding: 64px 48px; text-align: center; color: #fff; }
.final-cta h2 { font-size: 32px; font-weight: 600; margin-bottom: 14px; color: #fff; }
.final-cta p { font-size: 15.5px; color: #FBDCE4; margin-bottom: 28px; }
.final-cta .btn-primary { background: #fff; color: var(--rose-deep); }
.final-cta .btn-primary:hover { background: #FCE7EC; box-shadow: none; }

.footer { padding: 48px 0 40px; border-top: 1px solid var(--line); margin-top: 20px; }
.footer-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 18px; }
.footer-links { display: flex; gap: 26px; font-size: 13px; color: var(--ink-soft); }
.footer-fine { font-size: 12px; color: var(--ink-faint); margin-top: 22px; }

.guest-link { font-size: 13px; font-weight: 500; color: var(--ink-faint); text-decoration: underline; background: none; border: none; cursor: pointer; }

@media (max-width: 880px) {
  .hero { grid-template-columns: 1fr; padding-top: 44px; }
  .hero h1 { font-size: 38px; }
  .steps { grid-template-columns: 1fr; }
  .features { grid-template-columns: repeat(2,1fr); }
  .quote-band { grid-template-columns: 1fr; padding: 40px 28px; }
  .quote-mark { display: none; }
  .nav-links { display: none; }
  .final-cta { padding: 44px 26px; }
}
```

- [ ] **Step 2: Write `components/landing/PricingCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import styles from './landing.module.css'

export function PricingCard() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const isYearly = billing === 'yearly'

  return (
    <div className={styles['pricing-card']}>
      <div className={styles['plan-name']}>Sugarlock Plus</div>

      <div className={styles['billing-toggle']} role="group" aria-label="Billing period">
        <button
          type="button"
          className={!isYearly ? styles.active : undefined}
          aria-pressed={!isYearly}
          onClick={() => setBilling('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={isYearly ? styles.active : undefined}
          aria-pressed={isYearly}
          onClick={() => setBilling('yearly')}
        >
          Yearly <span className={styles['save-tag']}>Save 24%</span>
        </button>
      </div>

      <div className={styles.price}>{isYearly ? <>$100<span>/year</span></> : <>$11<span>/month</span></>}</div>
      <div className={styles['price-note']}>{isYearly ? 'Billed once a year · cancel anytime' : 'Cancel anytime'}</div>

      <ul className={styles['pricing-list']}>
        <li><span className={styles.check}>✓</span> Unlimited scheduled gifts</li>
        <li><span className={styles.check}>✓</span> Suggestions from Amazon, Target, Walmart, Best Buy &amp; Etsy</li>
        <li><span className={styles.check}>✓</span> Grace-period shipping windows</li>
        <li><span className={styles.check}>✓</span> Address confirmation with map pins</li>
        <li><span className={styles.check}>✓</span> Color-coded calendar for every recipient</li>
      </ul>

      <a href="/auth/login" className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`} style={{ width: '100%' }}>
        Start free trial
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Write `components/landing/LandingPage.tsx`**

```tsx
import styles from './landing.module.css'
import { SkipLoginButton } from '@/components/SkipLoginButton'
import { PricingCard } from './PricingCard'

export function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <div className={styles.logo}>
            <div className={styles.mark}>S</div>
            <span>Sugarlock</span>
          </div>
          <div className={styles['nav-links']}>
            <a className={styles.navlink} href="#how">How it works</a>
            <a className={styles.navlink} href="#features">Features</a>
            <a className={styles.navlink} href="#pricing">Pricing</a>
          </div>
          <div className={styles['nav-cta']}>
            <a className={styles['signin-link']} href="/auth/login">Sign in</a>
            <a className={`${styles.btn} ${styles['btn-primary']}`} href="/auth/login">Get started</a>
          </div>
        </nav>
      </header>

      <main className={styles.wrap}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>🎁 Gifting, on autopilot</span>
            <h1>Gifts that arrive <em>right on time</em> — every time.</h1>
            <p className={styles.sub}>
              Tell Sugarlock the day and who it&apos;s for. We&apos;ll suggest something within budget, and ship it
              to land in a window you set — never early, never late.
            </p>
            <div className={styles['hero-ctas']}>
              <a href="/auth/login" className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}>
                Get started free
              </a>
              <a href="#how" className={styles['link-arrow']}>
                See how it works
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
            <div className={styles['trust-line']}>Shipping from the stores you already trust</div>
            <div className={styles['trust-marks']}>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#FF9900' }}>a</div><span>Amazon</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#CC0000' }}>T</div><span>Target</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#0071CE' }}>W</div><span>Walmart</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#0A4FA0' }}>BB</div><span>Best Buy</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#F1641E' }}>e</div><span>Etsy</span></div>
              <div className={`${styles['store-chip']} ${styles.more}`}><span>+ many others, based on your selection</span></div>
            </div>
            <div style={{ marginTop: 18 }}>
              <SkipLoginButton />
            </div>
          </div>

          <div className={styles['daystrip-card']}>
            <div className={styles['daystrip-head']}>
              <div className={styles.who}>
                <div className={styles['daystrip-avatar']}>M</div>
                <div>
                  <div>Maria&apos;s birthday</div>
                  <small>Headphones · $59 · Best Buy</small>
                </div>
              </div>
              <div className={styles['daystrip-status']}>On schedule</div>
            </div>

            <div className={styles['strip-track']}>
              <div className={styles['gift-glider']}>🎁</div>
              <div className={styles['strip-day']}>6</div>
              <div className={styles['strip-day']}>7</div>
              <div className={styles['strip-day']}>8</div>
              <div className={`${styles['strip-day']} ${styles.grace}`}>9</div>
              <div className={`${styles['strip-day']} ${styles.grace}`}>10</div>
              <div className={`${styles['strip-day']} ${styles.grace}`}>11</div>
              <div className={`${styles['strip-day']} ${styles.eventday}`}><span className={styles.pin}>📍</span>12</div>
            </div>
            <div className={styles['strip-caption']}>
              <span><b>Grace window</b> · 3 days before</span>
              <span className={styles.arrive}>Arrives Mar 12</span>
            </div>
          </div>
        </section>

        <section className={styles.section} id="how">
          <div className={styles['section-head']}>
            <span className={styles['section-eyebrow']}>How it works</span>
            <h2>Three steps, then forget about it.</h2>
            <p>Sugarlock handles the remembering, the picking, and the shipping — you just say yes to the gift.</p>
          </div>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepnum}>01</span>
              <div className={styles['step-rule']} />
              <h3>Add the day</h3>
              <p>Drop a birthday, anniversary, or graduation on the calendar with who it&apos;s for and where it should go.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepnum}>02</span>
              <div className={styles['step-rule']} />
              <h3>Pick from suggestions</h3>
              <p>Tell us a category and a budget — we&apos;ll pull real options from Amazon, Target, Walmart, and more.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepnum}>03</span>
              <div className={styles['step-rule']} />
              <h3>It ships itself</h3>
              <p>Set a grace window and we place the order so it lands inside it. No last-minute scrambling.</p>
            </div>
          </div>
        </section>

        <section className={styles.section} id="features">
          <div className={styles['section-head']}>
            <span className={styles['section-eyebrow']}>Built for busy people</span>
            <h2>Everything a thoughtful gift needs — minus the last-minute panic.</h2>
          </div>
          <div className={styles.features}>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--rose-tint)' }}>🔎</div>
              <h3>Smart suggestions</h3>
              <p>Type what you&apos;re picturing and a budget — get real, in-stock options back.</p>
            </div>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--sage-tint)' }}>⏳</div>
              <h3>Grace period shipping</h3>
              <p>Set how early is okay to arrive. We time the order so it never lands late.</p>
            </div>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--gold-tint)' }}>📍</div>
              <h3>Confirmed addresses</h3>
              <p>Every shipping address is pinned on a map before an order goes out.</p>
            </div>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--rose-tint)' }}>🎨</div>
              <h3>Color-coded calendar</h3>
              <p>Give every person their own color, so your whole year is legible at a glance.</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles['quote-band']}>
            <div className={styles['quote-mark']}>&rdquo;</div>
            <div>
              <blockquote>
                I used to scramble for gifts every single month. Now Sugarlock handles it before I even remember the
                date is coming.
              </blockquote>
              <div className={styles.attribution}><b>Anna R.</b> — manages 20 birthdays a year with Sugarlock</div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="pricing">
          <div className={styles['section-head']} style={{ marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
            <span className={styles['section-eyebrow']}>Simple pricing</span>
            <h2>One plan. Every occasion.</h2>
          </div>
          <PricingCard />
        </section>

        <section className={styles.section} style={{ paddingTop: 0 }}>
          <div className={styles['final-cta']}>
            <h2>Never miss a day again.</h2>
            <p>Set up your first gift in under two minutes.</p>
            <a href="/auth/login" className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}>Get started free</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles['footer-row']}`}>
          <div className={styles.logo}>
            <div className={styles.mark}>S</div>
            <span>Sugarlock</span>
          </div>
          <div className={styles['footer-links']}>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/auth/login">Sign in</a>
          </div>
        </div>
        <div className={`${styles.wrap} ${styles['footer-fine']}`}>© 2026 Sugarlock. Built for the Auth0 × Stripe &quot;Built Different&quot; hackathon.</div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/landing/`.

- [ ] **Step 5: Commit**

```bash
git add components/landing
git commit -m "feat: port landing page from design/sugarlock-landing.html"
```

---

## Task 12: Calendar app — shared types + CSS module

**Files:**
- Create: `components/calendar/types.ts`
- Create: `components/calendar/calendar.module.css`

Ported from `design/sugarlock-calendar-mockup.html`, same bracket-notation convention as Task 11. Renames applied: `--raspberry`/`--raspberry-tint` → `--rose`/`--rose-tint` (already-global tokens), `--today-ring` → `var(--ink)` (dropped as its own token, same color), the mockup's local `--line` → `var(--line-neutral)` (renamed to avoid colliding with the landing page's warmer `--line`). Two additions beyond the mockup, per the design spec: `.sidebar-footer` (account/logout row — the mockup has no account UI at all) and `.upcoming-status` + its three modifier classes (status pill in the Upcoming list). `.retry-link` replaces an inline `style=` attribute the mockup set via JS. `.leaflet-pane`/`.leaflet-control` are Leaflet's own injected classnames, not ours, so they're wrapped in `:global()`.

- [ ] **Step 1: Write `components/calendar/types.ts`**

```ts
export type GiftStatus = 'scheduled' | 'ordered' | 'delivered'

export type ScheduledGift = {
  id: string
  recipientName: string
  address: string
  lat: number | null
  lng: number | null
  occasion: string | null
  eventDate: string
  graceDays: number
  colorHex: string
  productIcon: string | null
  productName: string | null
  productPriceCents: number | null
  productStore: string | null
  status: GiftStatus
}
```

- [ ] **Step 2: Write `components/calendar/calendar.module.css`**

```css
.app {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  font-family: "Inter", -apple-system, sans-serif;
}
.app :global(*) { box-sizing: border-box; }

.sidebar { border-right: 1px solid var(--line-neutral); padding: 24px 20px; background: var(--panel); display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
.brand .mark {
  width: 32px; height: 32px; border-radius: 9px;
  background: var(--rose);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-family: "Space Grotesk"; font-weight: 700; font-size: 15px;
}
.brand span { font-family: "Space Grotesk"; font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
.new-btn {
  width: 100%; padding: 12px 14px; border-radius: 999px; border: none;
  background: var(--ink); color: #fff;
  font-family: "Inter"; font-weight: 600; font-size: 13.5px;
  cursor: pointer; display: flex; align-items: center; gap: 8px;
  margin-bottom: 28px; transition: background .15s ease;
}
.new-btn:hover { background: #000; }
.new-btn svg { flex-shrink: 0; }

.side-section { margin-bottom: 26px; }
.side-title { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
.upcoming-item { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line-neutral); cursor: pointer; }
.upcoming-item:last-child { border-bottom: none; }
.upcoming-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--rose); margin-top: 5px; flex-shrink: 0; }
.upcoming-name { font-size: 13px; font-weight: 600; }
.upcoming-meta { font-size: 11.5px; color: var(--ink-soft); margin-top: 1px; }
.upcoming-status {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  border-radius: 999px; padding: 2px 7px; margin-top: 3px; display: inline-block;
}
.upcoming-status.scheduled { background: var(--rose-tint); color: var(--rose-deep); }
.upcoming-status.ordered { background: var(--gold-tint); color: var(--gold); }
.upcoming-status.delivered { background: var(--sage-tint); color: var(--sage); }

.legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-soft); margin-bottom: 7px; }
.legend-swatch { width: 10px; height: 10px; border-radius: 3px; }

.sidebar-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--line-neutral); font-size: 12.5px; color: var(--ink-faint); display: flex; align-items: center; justify-content: space-between; }
.sidebar-footer a, .sidebar-footer button { border: none; background: none; color: var(--ink-faint); text-decoration: underline; cursor: pointer; font-size: 12.5px; }

.main { display: flex; flex-direction: column; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; border-bottom: 1px solid var(--line-neutral); }
.topbar-left { display: flex; align-items: center; gap: 18px; }
.month-title { font-family: "Space Grotesk"; font-weight: 600; font-size: 22px; letter-spacing: -0.01em; }
.nav-btns { display: flex; gap: 4px; }
.nav-btns button {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line-neutral);
  background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: var(--ink-soft);
}
.nav-btns button:hover { background: var(--bg); }
.today-btn { border: 1px solid var(--line-neutral); background: #fff; border-radius: 8px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink); }

.grid-wrap { padding: 8px 28px 28px; flex: 1; }
.weekday-row { display: grid; grid-template-columns: repeat(7,1fr); padding: 10px 0 6px; }
.weekday-row div { text-align: center; font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--ink-faint); text-transform: uppercase; }
.month-grid { display: grid; grid-template-columns: repeat(7,1fr); grid-auto-rows: 112px; border-top: 1px solid var(--line-neutral); border-left: 1px solid var(--line-neutral); }
.day-cell { border-right: 1px solid var(--line-neutral); border-bottom: 1px solid var(--line-neutral); padding: 6px 6px 0; position: relative; cursor: pointer; transition: background .12s ease; }
.day-cell:hover { background: #fbfbfa; }
.day-cell.other-month { background: #fcfcfb; }
.day-cell.other-month .day-num { color: var(--ink-faint); }
.day-cell.grace-range { background: var(--sage-tint); }
.day-cell.grace-range:hover { background: #e2ede0; }

.day-num { font-size: 12.5px; font-weight: 600; color: var(--ink-soft); display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; }
.day-cell.is-today .day-num { background: var(--ink); color: #fff; border-radius: 50%; }

.gift-chip { margin-top: 4px; border-radius: 5px; padding: 3px 6px; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; }
.gift-chip .gift-icon { flex-shrink: 0; }
.grace-tag {
  position: absolute; top: 6px; right: 7px;
  font-size: 9.5px; font-weight: 700; color: var(--sage);
  background: #fff; border: 1px solid var(--sage); border-radius: 5px;
  padding: 1px 5px; letter-spacing: .02em;
}

.overlay { position: fixed; inset: 0; background: rgba(28,27,25,.32); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
.modal { background: #fff; border-radius: 18px; width: 460px; max-width: 100%; box-shadow: 0 24px 60px rgba(0,0,0,.22); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column; }
.modal-header { padding: 20px 22px 16px; border-bottom: 1px solid var(--line-neutral); display: flex; align-items: flex-start; justify-content: space-between; }
.modal-header h2 { font-family: "Space Grotesk"; font-size: 18px; font-weight: 600; margin: 0 0 4px; }
.modal-header p { margin: 0; font-size: 12.5px; color: var(--ink-soft); }
.close-x { border: none; background: none; cursor: pointer; color: var(--ink-faint); font-size: 18px; line-height: 1; padding: 4px; }
.modal-body { padding: 20px 22px; overflow-y: auto; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 6px; letter-spacing: .01em; }
.field .hint { font-weight: 400; color: var(--ink-faint); font-size: 11px; margin-left: 4px; }
.field input, .field textarea {
  width: 100%; border: 1px solid var(--line-neutral); border-radius: 9px;
  padding: 10px 12px; font-size: 13.5px; font-family: "Inter"; color: var(--ink);
  background: var(--bg);
}
.field input:focus, .field textarea:focus { outline: none; border-color: var(--rose); background: #fff; }
.field textarea { resize: vertical; min-height: 56px; }

.grace-control { display: flex; align-items: center; gap: 12px; background: var(--sage-tint); border-radius: 10px; padding: 12px 14px; }
.grace-control input[type="range"] { flex: 1; accent-color: var(--sage); }
.grace-value { font-family: "Space Grotesk"; font-weight: 700; font-size: 14px; color: var(--sage); min-width: 64px; text-align: right; }
.grace-explain { font-size: 11.5px; color: var(--ink-soft); margin-top: 8px; line-height: 1.5; }
.grace-explain b { color: var(--ink); }

.color-picker { display: flex; flex-wrap: wrap; gap: 9px; }
.color-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; position: relative; padding: 0; }
.color-swatch:hover { transform: scale(1.08); }
.color-swatch.selected { border-color: var(--ink); box-shadow: 0 0 0 2px #fff, 0 0 0 3px var(--ink); }
.color-swatch.selected::after {
  content: "✓"; position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 11px; font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,.35);
}

.address-status { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-top: 7px; color: var(--ink-faint); }
.address-status.found { color: var(--sage); font-weight: 600; }
.spinner { width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--line-neutral); border-top-color: var(--ink-faint); animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.address-map { margin-top: 9px; height: 150px; border-radius: 10px; border: 1px solid var(--line-neutral); overflow: hidden; background: var(--bg); display: none; }
.address-map.visible { display: block; }
.address-map :global(.leaflet-pane), .address-map :global(.leaflet-control) { z-index: 1; }

.retry-link { color: var(--rose); font-weight: 600; }

.product-search-row { display: flex; gap: 8px; }
.product-search-row input { border: 1px solid var(--line-neutral); border-radius: 9px; padding: 10px 12px; font-size: 13.5px; font-family: "Inter"; color: var(--ink); background: var(--bg); }
.product-search-row input:focus { outline: none; border-color: var(--rose); background: #fff; }
.query-input { flex: 2; }
.budget-input-wrap { flex: 1; position: relative; }
.budget-input-wrap span { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--ink-faint); pointer-events: none; }
.budget-input-wrap input { width: 100%; padding-left: 20px; }
.find-btn { border: none; border-radius: 9px; background: var(--ink); color: #fff; font-size: 13px; font-weight: 600; padding: 0 16px; cursor: pointer; white-space: nowrap; }
.find-btn:hover { background: #000; }

.suggestions { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.suggestion-card { border: 1.5px solid var(--line-neutral); border-radius: 11px; padding: 10px 11px; cursor: pointer; background: #fff; position: relative; transition: border-color .12s ease, background .12s ease; }
.suggestion-card:hover { border-color: #cfcbc2; }
.suggestion-card.selected { border-color: var(--rose); background: var(--rose-tint); }
.suggestion-icon { font-size: 20px; margin-bottom: 4px; }
.suggestion-name { font-size: 12.5px; font-weight: 700; color: var(--ink); line-height: 1.3; }
.suggestion-meta { font-size: 11px; color: var(--ink-soft); margin-top: 3px; display: flex; align-items: center; gap: 5px; }
.store-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
.suggestion-check { position: absolute; top: 8px; right: 8px; width: 16px; height: 16px; border-radius: 50%; background: var(--rose); color: #fff; display: none; align-items: center; justify-content: center; font-size: 10px; }
.suggestion-card.selected .suggestion-check { display: flex; }

.no-results { font-size: 12px; color: var(--ink-faint); padding: 10px 2px; }

.selected-summary { margin-top: 12px; display: flex; align-items: center; gap: 10px; background: var(--sage-tint); border-radius: 10px; padding: 10px 12px; }
.selected-summary .icon { font-size: 20px; }
.selected-summary .info { flex: 1; }
.selected-summary .info .name { font-size: 12.5px; font-weight: 700; color: var(--ink); }
.selected-summary .info .meta { font-size: 11px; color: var(--ink-soft); display: flex; align-items: center; gap: 5px; }
.selected-summary .clear-btn { border: none; background: none; color: var(--ink-faint); cursor: pointer; font-size: 13px; }

.event-date-display { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; background: var(--rose-tint); color: var(--rose-deep); border-radius: 9px; padding: 10px 12px; }

.modal-footer { padding: 16px 22px 22px; display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--line-neutral); }
.btn { padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--line-neutral); background: #fff; color: var(--ink); }
.btn.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
.btn.primary:hover { background: #000; }
.btn:hover { background: var(--bg); }
```

- [ ] **Step 3: Commit**

```bash
git add components/calendar/types.ts components/calendar/calendar.module.css
git commit -m "feat: add calendar app types and ported CSS module"
```

---

## Task 13: `components/calendar/AddressMap.tsx`

**Files:**
- Create: `components/calendar/AddressMap.tsx`

Uses the npm `leaflet` package (installed in Task 6) instead of the mockup's CDN `<script>` tag. Marker icon URLs point at the same cdnjs build the mockup used (1.9.4) rather than bundling local image assets — sidesteps the well-known Leaflet-plus-bundler broken-default-icon-path issue entirely.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './calendar.module.css'

const DEFAULT_ICON = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export function AddressMap({ lat, lng, visible }: { lat: number; lng: number; visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapRef.current = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(mapRef.current)

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !visible) return
    mapRef.current.invalidateSize()
    mapRef.current.setView([lat, lng], 15)
    if (markerRef.current) mapRef.current.removeLayer(markerRef.current)
    markerRef.current = L.marker([lat, lng], { icon: DEFAULT_ICON }).addTo(mapRef.current)
  }, [lat, lng, visible])

  return <div ref={containerRef} className={`${styles['address-map']} ${visible ? styles.visible : ''}`} />
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/AddressMap.tsx
git commit -m "feat: add AddressMap Leaflet component"
```

---

## Task 14: `components/calendar/Sidebar.tsx`

**Files:**
- Create: `components/calendar/Sidebar.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import styles from './calendar.module.css'
import { GuestLogoutButton } from '@/components/GuestLogoutButton'
import type { ScheduledGift } from './types'

const LEGEND_GRADIENT = 'linear-gradient(90deg,#D50000,#F4511E,#039BE5)'

export function Sidebar({
  gifts,
  isGuest,
  onScheduleClick,
  onUpcomingClick,
}: {
  gifts: ScheduledGift[]
  isGuest: boolean
  onScheduleClick: () => void
  onUpcomingClick: (gift: ScheduledGift) => void
}) {
  const upcoming = [...gifts].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.mark}>S</div>
        <span>Sugarlock</span>
      </div>

      <button className={styles['new-btn']} onClick={onScheduleClick}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Schedule a gift
      </button>

      <div className={styles['side-section']}>
        <div className={styles['side-title']}>Upcoming</div>
        <div>
          {upcoming.map((gift) => (
            <div key={gift.id} className={styles['upcoming-item']} onClick={() => onUpcomingClick(gift)}>
              <div className={styles['upcoming-dot']} style={{ background: gift.colorHex }} />
              <div>
                <div className={styles['upcoming-name']}>
                  {gift.recipientName}
                  {gift.occasion ? ` — ${gift.occasion}` : ''}
                </div>
                <div className={styles['upcoming-meta']}>
                  {gift.productName
                    ? `${gift.productIcon ?? ''} ${gift.productName} · $${((gift.productPriceCents ?? 0) / 100).toFixed(0)} · ${gift.productStore}`
                    : new Date(gift.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <span className={`${styles['upcoming-status']} ${styles[gift.status]}`}>{gift.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles['side-section']}>
        <div className={styles['side-title']}>Legend</div>
        <div className={styles['legend-row']}>
          <div className={styles['legend-swatch']} style={{ background: LEGEND_GRADIENT }} /> Each gift has its own color
        </div>
        <div className={styles['legend-row']}>
          <div className={styles['legend-swatch']} style={{ background: 'var(--sage)' }} /> Grace period window
        </div>
      </div>

      <div className={styles['sidebar-footer']}>
        <span>{isGuest ? 'Browsing as guest' : 'Signed in'}</span>
        {isGuest ? <GuestLogoutButton /> : <a href="/auth/logout">Log out</a>}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/calendar/Sidebar.tsx
git commit -m "feat: add calendar Sidebar component"
```

---

## Task 15: `components/calendar/CalendarTopBar.tsx`

**Files:**
- Create: `components/calendar/CalendarTopBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import styles from './calendar.module.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function CalendarTopBar({ viewDate, onChange }: { viewDate: Date; onChange: (date: Date) => void }) {
  function shiftMonth(delta: number) {
    const next = new Date(viewDate)
    next.setMonth(next.getMonth() + delta)
    onChange(next)
  }

  return (
    <div className={styles.topbar}>
      <div className={styles['topbar-left']}>
        <div className={styles['month-title']}>
          {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
        </div>
        <div className={styles['nav-btns']}>
          <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
          <button aria-label="Next month" onClick={() => shiftMonth(1)}>›</button>
        </div>
      </div>
      <button className={styles['today-btn']} onClick={() => onChange(new Date())}>Today</button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/CalendarTopBar.tsx
git commit -m "feat: add CalendarTopBar component"
```

---

## Task 16: `components/calendar/MonthGrid.tsx`

**Files:**
- Create: `components/calendar/MonthGrid.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import styles from './calendar.module.css'
import type { ScheduledGift } from './types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${m}-${d}`
}

function sameYMD(date: Date, y: number, m: number, d: number): boolean {
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function MonthGrid({
  viewDate,
  gifts,
  onDayClick,
}: {
  viewDate: Date
  gifts: ScheduledGift[]
  onDayClick: (date: Date) => void
}) {
  const y = viewDate.getFullYear()
  const m = viewDate.getMonth()
  const today = new Date()

  const firstOfMonth = new Date(y, m, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(y, m, 1 - startOffset)

  const giftsByDay = new Map<string, ScheduledGift>()
  for (const gift of gifts) {
    const d = new Date(gift.eventDate)
    giftsByDay.set(dayKey(d.getFullYear(), d.getMonth(), d.getDate()), gift)
  }

  const graceDays = new Set<string>()
  for (const gift of gifts) {
    const eventDate = new Date(gift.eventDate)
    for (let g = 1; g <= gift.graceDays; g++) {
      const gd = new Date(eventDate)
      gd.setDate(gd.getDate() - g)
      graceDays.add(dayKey(gd.getFullYear(), gd.getMonth(), gd.getDate()))
    }
  }

  const cells = []
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart)
    cellDate.setDate(gridStart.getDate() + i)
    const cy = cellDate.getFullYear()
    const cm = cellDate.getMonth()
    const cd = cellDate.getDate()
    const gift = giftsByDay.get(dayKey(cy, cm, cd))

    const classNames = [styles['day-cell']]
    if (cm !== m) classNames.push(styles['other-month'])
    if (sameYMD(today, cy, cm, cd)) classNames.push(styles['is-today'])
    if (graceDays.has(dayKey(cy, cm, cd))) classNames.push(styles['grace-range'])

    cells.push(
      <div key={i} className={classNames.join(' ')} onClick={() => onDayClick(new Date(cy, cm, cd))}>
        <div className={styles['day-num']}>{cd}</div>
        {gift && (
          <>
            <div
              className={styles['gift-chip']}
              style={{
                background: hexToRgba(gift.colorHex, 0.14),
                color: gift.colorHex,
                borderLeft: `3px solid ${gift.colorHex}`,
              }}
              title={
                gift.productName
                  ? `${gift.productName} · $${((gift.productPriceCents ?? 0) / 100).toFixed(0)}`
                  : gift.recipientName
              }
            >
              <span className={styles['gift-icon']}>{gift.productIcon ?? '🎁'}</span> {gift.recipientName}
            </div>
            <div className={styles['grace-tag']}>Grace {gift.graceDays}d</div>
          </>
        )}
      </div>,
    )
  }

  return (
    <div className={styles['grid-wrap']}>
      <div className={styles['weekday-row']}>
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className={styles['month-grid']}>{cells}</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/MonthGrid.tsx
git commit -m "feat: add MonthGrid component"
```

---

## Task 17: `components/calendar/ScheduleGiftModal.tsx`

**Files:**
- Create: `components/calendar/ScheduleGiftModal.tsx`

`AddressMap` is dynamically imported with `ssr: false` since Leaflet requires `window`. Geocoding is debounced 900ms after the address changes, matching the mockup. A `retryNonce` counter re-fires the same debounced effect when the user clicks "Try again" after a failed lookup, without requiring the address text to change (the mockup did this via direct DOM re-invocation, which doesn't have a React equivalent — the counter is the correct translation, not a placeholder).

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import styles from './calendar.module.css'
import { searchCatalog, STORE_COLORS, type CatalogItem } from '@/lib/catalog'
import { fetchGeocode } from '@/lib/geocode'
import type { ScheduledGift } from './types'

const AddressMap = dynamic(() => import('./AddressMap').then((m) => m.AddressMap), { ssr: false })

const COLOR_PALETTE = [
  { name: 'Tomato', hex: '#D50000' },
  { name: 'Tangerine', hex: '#F4511E' },
  { name: 'Banana', hex: '#F6BF26' },
  { name: 'Sage', hex: '#33B679' },
  { name: 'Basil', hex: '#0B8043' },
  { name: 'Peacock', hex: '#039BE5' },
  { name: 'Blueberry', hex: '#3F51B5' },
  { name: 'Lavender', hex: '#7986CB' },
  { name: 'Grape', hex: '#8E24AA' },
  { name: 'Flamingo', hex: '#E67C73' },
  { name: 'Graphite', hex: '#616161' },
]
const DEFAULT_COLOR = COLOR_PALETTE[1].hex

type AddressStatus = 'idle' | 'loading' | 'found' | 'error'

export function ScheduleGiftModal({
  date,
  existingGift,
  onClose,
  onSaved,
}: {
  date: Date
  existingGift: ScheduledGift | null
  onClose: () => void
  onSaved: () => void
}) {
  const [recipientName, setRecipientName] = useState(existingGift?.recipientName ?? '')
  const [address, setAddress] = useState(existingGift?.address ?? '')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    existingGift?.lat != null && existingGift?.lng != null ? { lat: existingGift.lat, lng: existingGift.lng } : null,
  )
  const [addressStatus, setAddressStatus] = useState<AddressStatus>(existingGift?.lat != null ? 'found' : 'idle')
  const [retryNonce, setRetryNonce] = useState(0)
  const [color, setColor] = useState(existingGift?.colorHex ?? DEFAULT_COLOR)
  const [graceDays, setGraceDays] = useState(existingGift?.graceDays ?? 4)
  const [productQuery, setProductQuery] = useState('')
  const [productBudget, setProductBudget] = useState('')
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([])
  const [searched, setSearched] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<CatalogItem | null>(
    existingGift?.productName
      ? {
          icon: existingGift.productIcon ?? '🎁',
          name: existingGift.productName,
          price: (existingGift.productPriceCents ?? 0) / 100,
          store: existingGift.productStore ?? '',
          tags: [],
        }
      : null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = address.trim()
    if (trimmed.length < 6) {
      setAddressStatus('idle')
      setPin(null)
      return
    }
    setAddressStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const result = await fetchGeocode(trimmed)
        if (result) {
          setPin(result)
          setAddressStatus('found')
        } else {
          setPin(null)
          setAddressStatus('error')
        }
      } catch {
        setPin(null)
        setAddressStatus('error')
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [address, retryNonce])

  const dateLabel = useMemo(
    () => date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
    [date],
  )
  const graceExplainLabel = useMemo(() => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), [date])

  function handleSearch() {
    const budget = productBudget ? parseFloat(productBudget) : null
    setSuggestions(searchCatalog(productQuery, budget))
    setSearched(true)
  }

  async function handleSave() {
    if (!recipientName.trim()) return
    setSaving(true)
    setError(null)

    const payload = {
      recipientName: recipientName.trim(),
      address: address.trim(),
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      eventDate: date.toISOString(),
      graceDays,
      colorHex: color,
      product: selectedProduct,
    }

    try {
      const res = await fetch(existingGift ? `/api/gifts/${existingGift.id}` : '/api/gifts', {
        method: existingGift ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save gift')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal}>
        <div className={styles['modal-header']}>
          <div>
            <h2>Schedule a gift</h2>
            <p>Sugarlock will place the order and time shipping to arrive on the day.</p>
          </div>
          <button className={styles['close-x']} onClick={onClose}>✕</button>
        </div>

        <div className={styles['modal-body']}>
          <div className={styles.field}>
            <label>Special day</label>
            <div className={styles['event-date-display']}>🎁 {dateLabel}</div>
          </div>

          <div className={styles.field}>
            <label>Event color</label>
            <div className={styles['color-picker']}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`${styles['color-swatch']} ${color === c.hex ? styles.selected : ''}`}
                  style={{ background: c.hex }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => setColor(c.hex)}
                />
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label>Recipient name</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Maria Chen"
            />
          </div>

          <div className={styles.field}>
            <label>Shipping address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, state, ZIP"
              rows={2}
            />
            <div className={`${styles['address-status']} ${addressStatus === 'found' ? styles.found : ''}`}>
              {addressStatus === 'loading' && (
                <>
                  <span className={styles.spinner} /> Finding on map…
                </>
              )}
              {addressStatus === 'found' && '📍 Pinned'}
              {addressStatus === 'error' && (
                <>
                  Couldn&apos;t find that on the map yet.{' '}
                  <a
                    href="#"
                    className={styles['retry-link']}
                    onClick={(e) => {
                      e.preventDefault()
                      setRetryNonce((n) => n + 1)
                    }}
                  >
                    Try again
                  </a>
                </>
              )}
            </div>
            {pin && <AddressMap lat={pin.lat} lng={pin.lng} visible={addressStatus === 'found'} />}
          </div>

          <div className={styles.field}>
            <label>
              Find a gift <span className={styles.hint}>— type what you&apos;re picturing and a budget</span>
            </label>
            <div className={styles['product-search-row']}>
              <input
                type="text"
                className={styles['query-input']}
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. headphones"
              />
              <div className={styles['budget-input-wrap']}>
                <span>$</span>
                <input
                  type="number"
                  min="0"
                  value={productBudget}
                  onChange={(e) => setProductBudget(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Up to"
                />
              </div>
              <button className={styles['find-btn']} onClick={handleSearch}>Suggest</button>
            </div>

            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.slice(0, 6).map((item) => (
                  <div
                    key={item.name}
                    className={`${styles['suggestion-card']} ${selectedProduct?.name === item.name ? styles.selected : ''}`}
                    onClick={() => setSelectedProduct(item)}
                  >
                    <div className={styles['suggestion-check']}>✓</div>
                    <div className={styles['suggestion-icon']}>{item.icon}</div>
                    <div className={styles['suggestion-name']}>{item.name}</div>
                    <div className={styles['suggestion-meta']}>
                      <span className={styles['store-dot']} style={{ background: STORE_COLORS[item.store] ?? '#999' }} />
                      ${item.price} · {item.store}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searched && suggestions.length === 0 && (
              <div className={styles['no-results']}>No matches under that budget — try raising it or a different word.</div>
            )}

            {selectedProduct && (
              <div className={styles['selected-summary']}>
                <div className={styles.icon}>{selectedProduct.icon}</div>
                <div className={styles.info}>
                  <div className={styles.name}>{selectedProduct.name}</div>
                  <div className={styles.meta}>
                    <span className={styles['store-dot']} style={{ background: STORE_COLORS[selectedProduct.store] ?? '#999' }} />
                    ${selectedProduct.price} · {selectedProduct.store} · saved to this gift
                  </div>
                </div>
                <button className={styles['clear-btn']} onClick={() => setSelectedProduct(null)}>Change</button>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label>
              Grace period <span className={styles.hint}>— how early the gift can arrive before the day</span>
            </label>
            <div className={styles['grace-control']}>
              <input
                type="range"
                min="1"
                max="10"
                value={graceDays}
                onChange={(e) => setGraceDays(parseInt(e.target.value, 10))}
              />
              <div className={styles['grace-value']}>
                {graceDays} day{graceDays === 1 ? '' : 's'}
              </div>
            </div>
            <div className={styles['grace-explain']}>
              Sugarlock will place the order so it arrives sometime in the{' '}
              <b>
                {graceDays}-day window before {graceExplainLabel}
              </b>{' '}
              — never later.
            </div>
          </div>

          {error && <p style={{ fontSize: 12.5, color: 'var(--rose-deep)' }}>{error}</p>}
        </div>

        <div className={styles['modal-footer']}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.primary}`} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save gift'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/calendar/ScheduleGiftModal.tsx
git commit -m "feat: add ScheduleGiftModal component"
```

---

## Task 18: `components/calendar/CalendarApp.tsx`

**Files:**
- Create: `components/calendar/CalendarApp.tsx`

Composes Sidebar + CalendarTopBar + MonthGrid + ScheduleGiftModal, owns the gifts list and modal open/edit state, and fetches from the API routes built in Tasks 7–9. The order-check poll mirrors the old gift-detail page's poll-on-load fallback: after gifts load, if any aren't yet `delivered`, hit `/api/cron/order-check` once and reload — not an interval poller, same convention as before.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from './calendar.module.css'
import { Sidebar } from './Sidebar'
import { CalendarTopBar } from './CalendarTopBar'
import { MonthGrid } from './MonthGrid'
import { ScheduleGiftModal } from './ScheduleGiftModal'
import type { ScheduledGift } from './types'

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarApp({ isGuest }: { isGuest: boolean }) {
  const [gifts, setGifts] = useState<ScheduledGift[]>([])
  const [viewDate, setViewDate] = useState(() => new Date())
  const [modalState, setModalState] = useState<{ date: Date; gift: ScheduledGift | null } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/gifts')
    if (!res.ok) return
    const { gifts: loaded } = await res.json()
    setGifts(loaded)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (gifts.length === 0) return
    if (gifts.every((g) => g.status === 'delivered')) return
    fetch('/api/cron/order-check').then(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifts.length])

  function openModalForDate(date: Date) {
    const existing = gifts.find((g) => sameDay(new Date(g.eventDate), date)) ?? null
    setModalState({ date, gift: existing })
  }

  function openModalForGift(gift: ScheduledGift) {
    setModalState({ date: new Date(gift.eventDate), gift })
  }

  async function handleSaved() {
    setModalState(null)
    await load()
  }

  return (
    <div className={styles.app}>
      <Sidebar
        gifts={gifts}
        isGuest={isGuest}
        onScheduleClick={() => openModalForDate(new Date())}
        onUpcomingClick={openModalForGift}
      />
      <main className={styles.main}>
        <CalendarTopBar viewDate={viewDate} onChange={setViewDate} />
        <MonthGrid viewDate={viewDate} gifts={gifts} onDayClick={openModalForDate} />
      </main>
      {modalState && (
        <ScheduleGiftModal
          date={modalState.date}
          existingGift={modalState.gift}
          onClose={() => setModalState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/calendar/CalendarApp.tsx
git commit -m "feat: add CalendarApp composition component"
```

---

## Task 19: Rewire `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { getAppSession } from '@/lib/session'
import { upsertUserForSession } from '@/lib/users'
import { LandingPage } from '@/components/landing/LandingPage'
import { CalendarApp } from '@/components/calendar/CalendarApp'

export default async function Home() {
  const session = await getAppSession()
  if (!session?.user) return <LandingPage />

  await upsertUserForSession(session.user)
  return <CalendarApp isGuest={session.isGuest} />
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors across the whole project — this is the last file that referenced anything from the old app.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire landing page (logged out) and calendar app (logged in) at /"
```

---

## Task 20: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass — `order-engine.test.ts` (5), `catalog.test.ts` (4), `geocode.test.ts` (4). No leftover references to `unlock-engine.test.ts` or `confirm-token.test.ts` (deleted in Task 6).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 5: Manual smoke test against the dev server**

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "logged-out /: %{http_code}\n" http://localhost:3000/
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/guest -o /dev/null -w "guest login: %{http_code}\n"
curl -s -b /tmp/cookies.txt -o /dev/null -w "logged-in /: %{http_code}\n" http://localhost:3000/
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{"recipientName":"Test Recipient","address":"1 Infinite Loop, Cupertino, CA","eventDate":"2026-08-01T00:00:00.000Z","graceDays":4,"colorHex":"#F4511E"}' \
  -w "\ncreate gift: %{http_code}\n"
curl -s -b /tmp/cookies.txt http://localhost:3000/api/gifts -w "\nlist gifts: %{http_code}\n"
curl -s http://localhost:3000/api/cron/order-check -w "\norder-check: %{http_code}\n"
```

Expected: all `200`s; the created gift appears in the list response; landing page HTML (logged-out) contains "Gifts that arrive"; logged-in response contains the calendar app markup (e.g. "Schedule a gift").

- [ ] **Step 6: Commit anything outstanding and stop the dev server**

```bash
git add -A
git commit -m "chore: final verification pass for gift-scheduler pivot" --allow-empty
kill %1
```



