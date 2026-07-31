import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const user = await upsertUserForSession(session.user)
  const gifts = await prisma.scheduledGift.findMany({
    where: { userId: user.id },
    orderBy: { eventDate: 'asc' },
  })
  return NextResponse.json({ gifts })
}

export async function POST(request: NextRequest) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await request.json()
  const { recipientName, address, lat, lng, occasion, eventDate, graceDays, colorHex, product } = body

  if (!recipientName || typeof recipientName !== 'string') {
    return NextResponse.json({ error: 'recipientName is required' }, { status: 400 })
  }
  if (!eventDate) {
    return NextResponse.json({ error: 'eventDate is required' }, { status: 400 })
  }

  const user = await upsertUserForSession(session.user)
  const gift = await prisma.scheduledGift.create({
    data: {
      userId: user.id,
      recipientName,
      address: address ?? '',
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      occasion: occasion ?? null,
      eventDate: new Date(eventDate),
      graceDays: typeof graceDays === 'number' ? graceDays : 4,
      colorHex: colorHex ?? '#F4511E',
      productIcon: product?.icon ?? null,
      productName: product?.name ?? null,
      productPriceCents: typeof product?.price === 'number' ? Math.round(product.price * 100) : null,
      productStore: product?.store ?? null,
    },
  })
  return NextResponse.json({ gift })
}
