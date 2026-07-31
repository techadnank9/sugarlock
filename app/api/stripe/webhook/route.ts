import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? '', process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch (err) {
    return NextResponse.json({ error: `signature verification failed: ${(err as Error).message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session
    const giftId = checkoutSession.metadata?.scheduledGiftId
    if (giftId) {
      // Only ever flips unpaid → paid, so replaying the event is harmless.
      await prisma.scheduledGift.updateMany({
        where: { id: giftId, paymentStatus: 'unpaid' },
        data: { paymentStatus: 'paid' },
      })
    }
  }

  return NextResponse.json({ received: true })
}
