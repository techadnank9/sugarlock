import Stripe from 'stripe'

// The Stripe SDK requires a non-empty string at construction time, which would
// otherwise break `next build` in any environment without STRIPE_SECRET_KEY set.
// Real requests still fail without a real key — this only keeps module
// evaluation from throwing during build/page-data collection.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_unset', {
  apiVersion: '2026-07-29.dahlia',
})
