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

  const base = process.env.APP_BASE_URL ?? request.nextUrl.origin

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
    success_url: `${base}/gift/${gift.id}?funded=1`,
    cancel_url: `${base}/create`,
    metadata: { giftId: gift.id },
  })

  await prisma.gift.update({ where: { id: gift.id }, data: { stripeRef: checkoutSession.id } })

  return NextResponse.json({ url: checkoutSession.url })
}
