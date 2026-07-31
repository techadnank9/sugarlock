import { prisma } from './prisma'

export type GiftStatus = 'scheduled' | 'ordered' | 'delivered'

export type GiftStatusInput = {
  eventDate: Date
  graceDays: number
  status: GiftStatus
}

/** Midnight of the given instant, so comparisons are day-granular. Without
 * this a gift scheduled for today reads as delivered immediately, since its
 * timestamp is a moment already in the past. */
function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function evaluateGiftStatus(gift: GiftStatusInput, today: Date): GiftStatus {
  if (gift.status === 'delivered') return 'delivered'

  const eventDay = startOfDay(gift.eventDate)
  const currentDay = startOfDay(today)

  // Delivered only once the event day itself is over.
  if (currentDay > eventDay) return 'delivered'

  const graceStart = new Date(eventDay)
  graceStart.setDate(graceStart.getDate() - gift.graceDays)
  if (currentDay >= graceStart) return 'ordered'

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
