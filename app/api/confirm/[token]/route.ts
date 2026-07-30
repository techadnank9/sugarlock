import { NextRequest, NextResponse } from 'next/server'
import { verifyConfirmToken } from '@/lib/confirm-token'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { upsertUserForSession } from '@/lib/users'

/** Amount-free by construction — the confirmer never sees amountCents,
 * per docs/AUTH0_SETUP.md and docs/DATA_MODEL.md. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let conditionId: string
  try {
    ;({ conditionId } = await verifyConfirmToken(token))
  } catch {
    return NextResponse.json({ error: 'invalid or expired invite link' }, { status: 400 })
  }

  const condition = await prisma.condition.findUnique({
    where: { id: conditionId },
    include: { gift: { include: { recipient: true } }, confirmations: true },
  })
  if (!condition) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({
    conditionId,
    note: condition.gift.note,
    recipientDisplayName: condition.gift.recipient.displayName ?? condition.gift.recipient.email,
    label: (condition.params as { label?: string } | null)?.label ?? null,
    decision: condition.confirmations[0]?.decision ?? 'pending',
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth0.getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { token } = await params
  let conditionId: string
  try {
    ;({ conditionId } = await verifyConfirmToken(token))
  } catch {
    return NextResponse.json({ error: 'invalid or expired invite link' }, { status: 400 })
  }

  const { decision } = await request.json()
  if (!['approved', 'declined'].includes(decision)) {
    return NextResponse.json({ error: 'invalid decision' }, { status: 400 })
  }

  const confirmer = await upsertUserForSession(session.user)

  await prisma.confirmation.upsert({
    where: { conditionId },
    update: { decision, decidedAt: new Date(), confirmerId: confirmer.id },
    create: { conditionId, confirmerId: confirmer.id, decision, decidedAt: new Date() },
  })

  return NextResponse.json({ decision })
}
