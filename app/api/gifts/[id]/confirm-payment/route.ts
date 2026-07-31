import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

/** Same-effect fallback for the Stripe webhook: re-checks the stored Checkout
 * Session directly with Stripe when the browser lands back on the success URL,
 * so local dev works without `stripe listen` running. Idempotent. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const user = await upsertUserForSession(session.user)
  const gift = await prisma.scheduledGift.findUnique({ where: { id } })

  if (!gift) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (gift.userId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (gift.paymentStatus === 'paid') return NextResponse.json({ paid: true })
  if (!gift.stripeSessionId) return NextResponse.json({ paid: false })

  const checkoutSession = await stripe.checkout.sessions.retrieve(gift.stripeSessionId)
  if (checkoutSession.payment_status !== 'paid') return NextResponse.json({ paid: false })

  await prisma.scheduledGift.update({
    where: { id: gift.id },
    data: { paymentStatus: 'paid' },
  })
  return NextResponse.json({ paid: true })
}
