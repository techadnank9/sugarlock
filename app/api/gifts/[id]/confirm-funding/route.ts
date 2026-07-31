import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getAppSession } from '@/lib/session'

/** Redirect-fallback for local/demo environments where the Stripe webhook
 * can't reach localhost. Re-checks payment status directly with Stripe
 * before transitioning, so it's safe even if the webhook also fires. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const gift = await prisma.gift.findUniqueOrThrow({ where: { id } })

  if (gift.status !== 'draft') {
    return NextResponse.json({ status: gift.status })
  }
  if (!gift.stripeRef) {
    return NextResponse.json({ error: 'gift has no Stripe checkout session' }, { status: 409 })
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(gift.stripeRef)
  if (checkoutSession.payment_status !== 'paid') {
    return NextResponse.json({ status: 'draft' })
  }

  await prisma.$transaction([
    prisma.gift.update({ where: { id: gift.id }, data: { status: 'locked' } }),
    prisma.ledgerEntry.create({ data: { giftId: gift.id, event: 'funded', amountCents: gift.amountCents } }),
  ])

  return NextResponse.json({ status: 'locked' })
}
