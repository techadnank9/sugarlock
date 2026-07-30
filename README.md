# Sugarlock — handoff package

Time-locked money gifts. Auth0 San Francisco 2026 hackathon.

## Start here

Read BUILD_PLAN.md first — it's the full execution brief. Then build Phase 1.

## Contents

- BUILD_PLAN.md — the primary brief. Phases, stack, demo script, cut list.
- .env.example — every env var you'll need.
- docs/
  - DATA_MODEL.md — Prisma schema + status enum.
  - AUTH0_SETUP.md — three roles + confirmer scoping.
  - STRIPE_SETUP.md — Checkout, ledger escrow, webhook, leaderboard code.
  - FUNCTIONAL_FLOW.md — the gift lifecycle in words.
  - TECHNICAL_ARCHITECTURE.md — services and connections.
- diagrams/
  - functional-flow.svg — gift lifecycle graph.
  - technical-architecture.svg — system graph.
  - data-model.svg — ERD.
- design/
  - design-tokens.md — palette + type rationale.
  - globals.css — CSS variables, ready to drop in.
  - ui-prototype.html — clickable mockup of all five screens. Open in a browser.

## One-line summary for the agent

Build a Next.js + TypeScript + Tailwind app where a sender funds a gift via
Stripe, sets an unlock condition, and the money sits in a ledger-modeled escrow
until the condition is met (time, self-attested, third-party confirmed via a
scoped Auth0 role, or data-verified), at which point the recipient sees it unlock
and withdraws. Match the design in design/. Ship the phases in BUILD_PLAN.md in
order; each is independently demoable.
