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

type UnlockCandidate = {
  id: string
  amountCents: number
  condition: {
    type: ConditionInput['type']
    unlockAt: Date | null
    params: unknown
    confirmations: { decision: string }[]
  } | null
}

/**
 * Unlocks a single locked gift if its condition passes. Safe to call on every
 * gift read: it no-ops unless the condition is actually met, and the caller is
 * expected to have already confirmed the gift is still `locked`.
 */
export async function unlockGiftIfEligible(gift: UnlockCandidate): Promise<boolean> {
  if (!gift.condition) return false

  const passes = evaluateCondition({
    type: gift.condition.type,
    unlockAt: gift.condition.unlockAt,
    params: (gift.condition.params as Record<string, unknown>) ?? {},
    confirmations: gift.condition.confirmations,
  })
  if (!passes) return false

  await prisma.$transaction([
    prisma.gift.update({ where: { id: gift.id }, data: { status: 'unlocked' } }),
    prisma.ledgerEntry.create({
      data: { giftId: gift.id, event: 'unlocked', amountCents: gift.amountCents },
    }),
  ])
  return true
}

export async function runUnlockEngine(): Promise<{ checked: number; unlocked: string[] }> {
  const lockedGifts = await prisma.gift.findMany({
    where: { status: 'locked' },
    include: { condition: { include: { confirmations: true } } },
  })

  const unlocked: string[] = []

  for (const gift of lockedGifts) {
    if (await unlockGiftIfEligible(gift)) unlocked.push(gift.id)
  }

  return { checked: lockedGifts.length, unlocked }
}
