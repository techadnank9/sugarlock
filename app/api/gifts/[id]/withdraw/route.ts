import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const user = await upsertUserForSession(session.user)
  const gift = await prisma.gift.findUniqueOrThrow({ where: { id } })

  if (gift.recipientId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (gift.status !== 'unlocked') return NextResponse.json({ error: 'gift is not unlocked' }, { status: 409 })

  await prisma.$transaction([
    prisma.gift.update({ where: { id: gift.id }, data: { status: 'released' } }),
    prisma.ledgerEntry.create({ data: { giftId: gift.id, event: 'released', amountCents: gift.amountCents } }),
  ])

  return NextResponse.json({ status: 'released' })
}
