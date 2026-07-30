# Stripe setup

## Leaderboard requirement

List the project on the Stripe Leaderboard using code:

    auth0-sanfrancisco-2026

Do this early so it is not forgotten at demo time.

## Funding flow (sender pays in)

1. Sender submits the create form. App creates a Gift in `draft`.
2. App creates a Stripe Checkout Session for the gift amount.
3. Sender pays. On success (webhook `checkout.session.completed`, or the redirect
   as a fallback for the demo):
   - Move gift draft -> funded.
   - Write a LedgerEntry { event: 'funded', amountCents }.
   - Move funded -> locked.

## Escrow — model it as a ledger, not Connect

For the hackathon, do NOT build full Stripe Connect payouts. Instead:
- The sender's charge lands in the platform balance.
- "Held in escrow" is a derived value: sum(funded) - sum(released) per gift.
- On withdraw, write a LedgerEntry { event: 'released' } and (optionally) trigger
  a real transfer. For the demo, the ledger entry alone reads correctly on screen.

This saves the Connect onboarding flow, which eats hours. Upgrade to Connect for
real recipient payouts only if Phases 1-4 are done and time remains.

## Webhook

- Endpoint: /api/stripe/webhook
- Verify the signature with STRIPE_WEBHOOK_SECRET.
- Handle `checkout.session.completed` -> mark gift funded/locked as above.
- Keep it idempotent: check the gift is still `draft` before transitioning.

## Env vars

```
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

## Test cards

Use Stripe test mode. Card 4242 4242 4242 4242, any future expiry, any CVC.
