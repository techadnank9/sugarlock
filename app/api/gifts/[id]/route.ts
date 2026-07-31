import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { roleForGift } from '@/lib/roles'
import { unlockGiftIfEligible } from '@/lib/unlock-engine'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const user = await upsertUserForSession(session.user)
  const include = {
    condition: { include: { confirmations: true } },
    sender: true,
    recipient: true,
  } as const
  const gift = await prisma.gift.findUnique({ where: { id }, include })
  if (!gift) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const role = roleForGift(user.id, gift)
  if (role === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Evaluate the unlock condition on read, so a gift whose time has passed
  // reveals itself without waiting for the cron. No-ops unless it passes.
  if (gift.status === 'locked' && (await unlockGiftIfEligible(gift))) {
    const refreshed = await prisma.gift.findUnique({ where: { id }, include })
    if (refreshed) return NextResponse.json({ gift: refreshed, role })
  }

  return NextResponse.json({ gift, role })
}
