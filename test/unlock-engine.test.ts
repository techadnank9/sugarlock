import { describe, it, expect } from 'vitest'
import { evaluateCondition } from '../lib/unlock-engine'

describe('evaluateCondition', () => {
  it('time: unlocks when now is past unlockAt', () => {
    const past = new Date(Date.now() - 1000)
    expect(evaluateCondition({ type: 'time', unlockAt: past, params: {} })).toBe(true)
  })

  it('time: stays locked when unlockAt is in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60)
    expect(evaluateCondition({ type: 'time', unlockAt: future, params: {} })).toBe(false)
  })

  it('self: unlocks when params.markedDone is true', () => {
    expect(evaluateCondition({ type: 'self', unlockAt: null, params: { markedDone: true } })).toBe(true)
    expect(evaluateCondition({ type: 'self', unlockAt: null, params: { markedDone: false } })).toBe(false)
  })

  it('third_party: unlocks only when an approved confirmation exists', () => {
    expect(
      evaluateCondition({
        type: 'third_party',
        unlockAt: null,
        params: {},
        confirmations: [{ decision: 'pending' }, { decision: 'approved' }],
      })
    ).toBe(true)
    expect(
      evaluateCondition({
        type: 'third_party',
        unlockAt: null,
        params: {},
        confirmations: [{ decision: 'pending' }, { decision: 'declined' }],
      })
    ).toBe(false)
  })

  it('data: stub always returns params.signalMet', () => {
    expect(evaluateCondition({ type: 'data', unlockAt: null, params: { signalMet: true } })).toBe(true)
    expect(evaluateCondition({ type: 'data', unlockAt: null, params: {} })).toBe(false)
  })
})
