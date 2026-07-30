import { describe, it, expect, beforeAll } from 'vitest'
import { signConfirmToken, verifyConfirmToken } from '../lib/confirm-token'

beforeAll(() => {
  process.env.CONFIRM_TOKEN_SECRET = 'test-secret-at-least-32-bytes-long!!'
})

describe('confirm token', () => {
  it('signs and verifies a valid token round-trip', async () => {
    const token = await signConfirmToken('condition-123')
    const payload = await verifyConfirmToken(token)
    expect(payload.conditionId).toBe('condition-123')
  })

  it('rejects a tampered token', async () => {
    const token = await signConfirmToken('condition-123')
    const tampered = token.slice(0, -2) + 'xx'
    await expect(verifyConfirmToken(tampered)).rejects.toThrow()
  })
})
