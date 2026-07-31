import { describe, it, expect } from 'vitest'
import { simplifyAddress } from '../lib/geocode'

describe('simplifyAddress', () => {
  it('strips floor tokens', () => {
    expect(simplifyAddress('100 1st St 6th floor, San Francisco, CA 94105')).toBe(
      '100 1st St, San Francisco, CA 94105',
    )
  })

  it('strips suite/apt/unit tokens', () => {
    expect(simplifyAddress('500 Main St, Apt 4B, Austin, TX 78701')).toBe('500 Main St, Austin, TX 78701')
  })

  it('strips a bare # unit marker', () => {
    expect(simplifyAddress('12 Elm St #3, Portland, OR 97201')).toBe('12 Elm St, Portland, OR 97201')
  })

  it('leaves an address with no unit info unchanged', () => {
    expect(simplifyAddress('1 Infinite Loop, Cupertino, CA 95014')).toBe('1 Infinite Loop, Cupertino, CA 95014')
  })
})
