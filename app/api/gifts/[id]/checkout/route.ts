import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

/** Creates a Stripe Checkout Session for the gift's selected product and hands
 * the redirect URL back to the client. Re-callable: an abandoned checkout just
 * gets a fresh Session on the next attempt. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const user = await upsertUserForSession(session.user)
  const gift = await prisma.scheduledGift.findUnique({ where: { id } })

  if (!gift) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (gift.userId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (gift.paymentStatus === 'paid') {
    return NextResponse.json({ error: 'gift is already paid for' }, { status: 409 })
  }
  if (!gift.productName || !gift.productPriceCents) {
    return NextResponse.json({ error: 'pick a gift before paying' }, { status: 400 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe is not configured — set STRIPE_SECRET_KEY in .env.local and restart the dev server.' },
      { status: 500 },
    )
  }

  const base = process.env.APP_BASE_URL ?? request.nextUrl.origin

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${gift.productName} — for ${gift.recipientName}`,
            description: gift.productStore ? `Shipped from ${gift.productStore}` : undefined,
          },
          unit_amount: gift.productPriceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${base}/?checkout=success&gift=${gift.id}`,
    cancel_url: `${base}/?checkout=cancelled`,
    metadata: { scheduledGiftId: gift.id },
  })

  await prisma.scheduledGift.update({
    where: { id: gift.id },
    data: { stripeSessionId: checkoutSession.id },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
