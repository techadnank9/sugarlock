import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { roleForGift } from '@/lib/roles'
import { upsertUserForSession } from '@/lib/users'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth0.getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const user = await upsertUserForSession(session.user)
  const gift = await prisma.gift.findUnique({
    where: { id },
    include: { condition: { include: { confirmations: true } }, sender: true, recipient: true },
  })
  if (!gift) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const role = roleForGift(user.id, gift)
  if (role === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  return NextResponse.json({ gift, role })
}
