import { prisma } from './prisma'

export type ConditionInput = {
  type: 'time' | 'self' | 'third_party' | 'data'
  unlockAt: Date | null
  params: Record<string, unknown>
  confirmations?: { decision: string }[]
}

export function evaluateCondition(condition: ConditionInput): boolean {
  switch (condition.type) {
    case 'time':
      return condition.unlockAt !== null && new Date() >= condition.unlockAt
    case 'self':
      return condition.params.markedDone === true
    case 'third_party':
      return (condition.confirmations ?? []).some((c) => c.decision === 'approved')
    case 'data':
      return condition.params.signalMet === true
    default:
      return false
  }
}

export async function runUnlockEngine(): Promise<{ checked: number; unlocked: string[] }> {
  const lockedGifts = await prisma.gift.findMany({
    where: { status: 'locked' },
    include: { condition: { include: { confirmations: true } } },
  })

  const unlocked: string[] = []

  for (const gift of lockedGifts) {
    if (!gift.condition) continue
    const passes = evaluateCondition({
      type: gift.condition.type,
      unlockAt: gift.condition.unlockAt,
      params: (gift.condition.params as Record<string, unknown>) ?? {},
      confirmations: gift.condition.confirmations,
    })
    if (!passes) continue

    await prisma.$transaction([
      prisma.gift.update({ where: { id: gift.id }, data: { status: 'unlocked' } }),
      prisma.ledgerEntry.create({
        data: { giftId: gift.id, event: 'unlocked', amountCents: gift.amountCents },
      }),
    ])
    unlocked.push(gift.id)
  }

  return { checked: lockedGifts.length, unlocked }
}
