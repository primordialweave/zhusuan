import { describe, expect, it } from 'vitest'
import { toDateOnly } from './dateOnly'

describe('toDateOnly', () => {
  it.each([
    '2026-11-22',
    '2026-11-22T00:00:00Z',
    '2026-11-22T00:00:00+14:00',
    '2026-11-22T23:59:59.123456789-12:00',
  ])('keeps the original calendar date of %s', (value) => {
    expect(toDateOnly(value)).toBe('2026-11-22')
  })

  it.each([undefined, null, ''])('keeps missing dates empty (%s)', (value) => {
    expect(toDateOnly(value)).toBe('')
  })

  it('does not silently turn a malformed date into a valid-looking date', () => {
    expect(toDateOnly('2026-11-22 invalid')).toBe('2026-11-22 invalid')
  })
})
