import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession(request)
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const user = await upsertUserForSession(session.user)
  const existing = await prisma.scheduledGift.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.userId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json()
  const { recipientName, address, lat, lng, occasion, eventDate, graceDays, colorHex, product } = body

  const gift = await prisma.scheduledGift.update({
    where: { id },
    data: {
      recipientName: recipientName ?? existing.recipientName,
      address: address ?? existing.address,
      lat: typeof lat === 'number' ? lat : existing.lat,
      lng: typeof lng === 'number' ? lng : existing.lng,
      occasion: occasion ?? existing.occasion,
      eventDate: eventDate ? new Date(eventDate) : existing.eventDate,
      graceDays: typeof graceDays === 'number' ? graceDays : existing.graceDays,
      colorHex: colorHex ?? existing.colorHex,
      productIcon: product ? (product.icon ?? null) : existing.productIcon,
      productName: product ? (product.name ?? null) : existing.productName,
      productPriceCents: product
        ? typeof product.price === 'number'
          ? Math.round(product.price * 100)
          : null
        : existing.productPriceCents,
      productStore: product ? (product.store ?? null) : existing.productStore,
    },
  })
  return NextResponse.json({ gift })
}
