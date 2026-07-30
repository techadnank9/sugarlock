# Sugarlock — build plan

A monetized, multi-user SaaS app for the Auth0 San Francisco 2026 hackathon.
Send money that unlocks only when a chosen condition is met.

This document is the primary brief for Claude Code. Read it top to bottom, then
start at Phase 1. Every phase is independently demoable, so ship them in order
and stop wherever time runs out.

---

## 1. What we are building

A time-locked money gift app. A sender funds a gift, sets an unlock condition,
and the money sits in escrow until the condition is met. The recipient can see
the gift waiting but cannot touch it until it unlocks.

Three roles, all real users:
- Sender — creates and funds a gift.
- Recipient — sees the locked gift, receives the money on unlock.
- Confirmer — a scoped third party (teacher, doctor, friend) who can approve
  exactly one unlock condition and nothing else. This role is why Auth0 is core
  rather than cosmetic.

Four unlock condition types:
- time — unlocks on a date or after a duration. MVP baseline, always works.
- self — recipient marks the milestone done, optionally with an uploaded proof.
- third_party — a confirmer approves. This is the demo centerpiece.
- data — an external signal proves it (location, steps, verified event). Stretch.

---

## 2. Hackathon scoring (build toward these)

The judges score three axes, each 1-5:
- Innovative use case — third_party and data unlocks are the differentiator.
  Most people assume "time-locked" means just a timer; showing a live condition
  being met is the surprise.
- Visual design — the locked-to-unlocked transition is the money shot. Spend
  real polish on the unlock animation.
- Engaging presentation — the demo is an emotional arc, not a feature tour.

Required by the challenge (without these the project is not judged):
- Auth powered by Auth0.
- Payments powered by Stripe.
- Listed on the Stripe Leaderboard using code: auth0-sanfrancisco-2026.

---

## 3. Tech stack

- Framework: Next.js 14+ (App Router), TypeScript.
- Styling: Tailwind CSS. Design tokens are in design/design-tokens.md and
  design/globals.css — use them, do not invent a new palette.
- Auth: Auth0 (@auth0/nextjs-auth0). Three roles via a role claim + scoped
  confirmer access.
- Payments: Stripe (Checkout for funding; a ledger models escrow; Connect is a
  stretch for real payouts).
- Database: Postgres via Supabase or Neon (both free-tier, fast to provision).
  Use Prisma as the ORM. Schema is in docs/DATA_MODEL.md.
- Animation: Framer Motion, used specifically for the unlock reveal.
- Scheduled unlock checks: Vercel Cron in production; a poll-on-load fallback is
  fine for the demo.

---

## 4. Gift status state machine

A gift's `status` field drives the entire UI. Allowed transitions only:

    draft  -->  funded  -->  locked  -->  unlocked  -->  released

- draft — created, not yet paid for.
- funded — Stripe charge succeeded, money in platform balance.
- locked — waiting on its condition. The recipient sees it but cannot withdraw.
- unlocked — condition met. Reveal animation plays; withdraw becomes available.
- released — recipient has withdrawn.

The unlock engine ONLY ever moves a gift from locked to unlocked. Nothing else
touches that transition.

---

## 5. Build phases

### Phase 1 — Auth + shell (foundation)
- Scaffold Next.js + TypeScript + Tailwind. Wire the design tokens.
- Integrate Auth0 login/logout. Add a `role` to the user (sender/recipient are
  ordinary users; confirmer is scoped).
- Build the app shell: top bar with brand + role pill, empty home screen.
- Confirmer scoping: when a sender picks a third_party condition, generate a
  signed, single-purpose invite link (or an Auth0 org membership) that lets the
  confirmer approve exactly ONE condition. They can see the gift description and
  the pending decision — never the amount, never a withdraw control.
- Demo checkpoint: log in as each of the three roles and see the correct view.

### Phase 2 — Gift creation + funding
- Build the create form: amount, recipient email, note, condition type,
  condition params (date for time; confirmer email + label for third_party).
- On submit, create a gift in `draft`, then open Stripe Checkout for the sender
  to fund it.
- On successful payment (webhook or redirect), move gift to `funded`, write a
  `funded` row to the ledger, then to `locked`.
- Model escrow as a ledger table, NOT real Connect payouts — this saves the
  Connect onboarding flow. Upgrade to Connect only if time allows.
- Demo checkpoint: create and fund a gift; it appears locked on the recipient's
  home.

### Phase 3 — Unlock engine (the heart)
- Implement one function: `evaluateCondition(condition): boolean`.
  - time: `now >= unlock_at`
  - self: recipient submitted a mark (+ optional proof)
  - third_party: a CONFIRMATIONS row exists with decision = 'approved'
  - data: external signal check (stub for demo)
- A runner (Vercel Cron, or poll-on-load) iterates every `locked` gift, calls
  `evaluateCondition`, and flips passing gifts to `unlocked`. Write an `unlocked`
  ledger row.
- Keeping every type behind one function means a new unlock type is a new case,
  not a new system.
- Demo checkpoint: a confirmer approves; the gift flips to unlocked live.

### Phase 4 — Unlock moment + release
- When a gift is `unlocked`, the recipient's detail view plays the reveal
  (vessel bursts, color shifts ink/gold -> teal) via Framer Motion.
- Show a withdraw button that moves the gift to `released` and writes a
  `released` ledger row.
- This is the visual-design and presentation score — make it feel like
  something opening, not a status label changing.
- Demo checkpoint: full end-to-end runs cleanly.

---

## 6. Demo script (rehearse this exact flow)

Grandparent gifts a grandchild's graduation, confirmed by a teacher.
1. Sender (Rose) creates a $500 gift for Amara, condition = teacher confirms.
2. Recipient (Amara) sees it locked, "awaiting confirmation."
3. On a second screen, the confirmer (Ms. Okafor) logs in with her scoped role,
   sees only the yes/no question, and approves.
4. Amara's screen unlocks live — vessel opens, money releases, withdraw appears.

Two roles, one emotional payoff, under 90 seconds. Hits all three scoring axes.

---

## 7. Cut list (if behind)

- Ship `time` unlock as the guaranteed baseline, add `third_party` for the wow.
- Drop `self` and `data` entirely if needed.
- Fake escrow with the ledger; skip Connect.
- NEVER cut the unlock animation — it carries the visual + presentation scores.

---

## 8. Files in this package

- BUILD_PLAN.md — this file.
- docs/DATA_MODEL.md — full schema, Prisma models, status enum.
- docs/AUTH0_SETUP.md — roles, confirmer scoping, env vars.
- docs/STRIPE_SETUP.md — Checkout, ledger escrow, webhook, leaderboard code.
- docs/FUNCTIONAL_FLOW.md — the gift lifecycle in words.
- docs/TECHNICAL_ARCHITECTURE.md — services and how they connect.
- diagrams/functional-flow.svg — the lifecycle graph.
- diagrams/technical-architecture.svg — the system graph.
- diagrams/data-model.svg — the ERD.
- design/design-tokens.md — palette, type, spacing rationale.
- design/globals.css — ready-to-use CSS variables.
- design/ui-prototype.html — clickable static mockup of all five screens.

Start with Phase 1. Keep each phase demoable.
