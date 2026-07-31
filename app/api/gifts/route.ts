import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertUserForSession, upsertPendingUser } from '@/lib/users'
import { signConfirmToken } from '@/lib/confirm-token'
import { getAppSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await request.json()
  const { amountCents, recipientEmail, note, conditionType, conditionParams } = body

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be positive' }, { status: 400 })
  }
  if (!['time', 'self', 'third_party', 'data'].includes(conditionType)) {
    return NextResponse.json({ error: 'invalid conditionType' }, { status: 400 })
  }
  if (!recipientEmail) {
    return NextResponse.json({ error: 'recipientEmail is required' }, { status: 400 })
  }
  if (conditionType === 'third_party' && !conditionParams?.confirmerEmail) {
    return NextResponse.json({ error: 'conditionParams.confirmerEmail is required for third_party' }, { status: 400 })
  }

  const sender = await upsertUserForSession(session.user)
  const recipient = await upsertPendingUser(recipientEmail)

  const gift = await prisma.gift.create({
    data: {
      senderId: sender.id,
      recipientId: recipient.id,
      amountCents,
      note,
      status: 'draft',
      condition: {
        create: {
          type: conditionType,
          params: conditionParams ?? {},
          unlockAt:
            conditionType === 'time' && conditionParams?.unlockAt ? new Date(conditionParams.unlockAt) : null,
        },
      },
    },
    include: { condition: true },
  })

  let confirmUrl: string | null = null
  if (conditionType === 'third_party' && gift.condition) {
    const confirmer = await upsertPendingUser(conditionParams.confirmerEmail)
    await prisma.confirmation.create({
      data: { conditionId: gift.condition.id, confirmerId: confirmer.id, decision: 'pending' },
    })
    const token = await signConfirmToken(gift.condition.id)
    const base = process.env.APP_BASE_URL ?? request.nextUrl.origin
    confirmUrl = `${base}/confirm/${token}`
  }

  return NextResponse.json({ gift, confirmUrl })
}
