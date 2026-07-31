import { prisma } from './prisma'

export type GiftStatus = 'scheduled' | 'ordered' | 'delivered'

export type GiftStatusInput = {
  eventDate: Date
  graceDays: number
  status: GiftStatus
}

export function evaluateGiftStatus(gift: GiftStatusInput, today: Date): GiftStatus {
  if (gift.status === 'delivered') return 'delivered'
  if (today >= gift.eventDate) return 'delivered'

  const graceStart = new Date(gift.eventDate)
  graceStart.setDate(graceStart.getDate() - gift.graceDays)
  if (today >= graceStart) return 'ordered'

  return gift.status
}

export async function runOrderEngine(): Promise<{ checked: number; updated: string[] }> {
  const gifts = await prisma.scheduledGift.findMany({ where: { status: { not: 'delivered' } } })
  const today = new Date()
  const updated: string[] = []

  for (const gift of gifts) {
    const next = evaluateGiftStatus(gift, today)
    if (next !== gift.status) {
      await prisma.scheduledGift.update({ where: { id: gift.id }, data: { status: next } })
      updated.push(gift.id)
    }
  }

  return { checked: gifts.length, updated }
}
