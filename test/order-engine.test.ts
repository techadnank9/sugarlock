import { describe, it, expect } from 'vitest'
import { evaluateGiftStatus } from '../lib/order-engine'

describe('evaluateGiftStatus', () => {
  const eventDate = new Date('2026-03-12T00:00:00Z')

  it('stays scheduled when today is before the grace window', () => {
    const today = new Date('2026-03-01T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'scheduled' }, today)).toBe('scheduled')
  })

  it('moves to ordered once today enters the grace window', () => {
    const today = new Date('2026-03-09T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'scheduled' }, today)).toBe('ordered')
  })

  it('moves to delivered on the event day', () => {
    const today = new Date('2026-03-12T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'ordered' }, today)).toBe('delivered')
  })

  it('moves to delivered after the event day even if it skipped ordered', () => {
    const today = new Date('2026-03-15T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'scheduled' }, today)).toBe('delivered')
  })

  it('never regresses an already-delivered gift', () => {
    const today = new Date('2026-01-01T00:00:00Z')
    expect(evaluateGiftStatus({ eventDate, graceDays: 4, status: 'delivered' }, today)).toBe('delivered')
  })
})
