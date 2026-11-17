import { describe, expect, it } from 'vitest'
import { formatAmount, formatCurrency, formatDate } from './format'

describe('formatAmount', () => {
  it('shows whole amounts without decimals', () => {
    expect(formatAmount(3600)).toBe('¥3,600')
    expect(formatAmount(1234567)).toBe('¥1,234,567')
  })

  it('keeps cents instead of rounding them away', () => {
    expect(formatAmount(3600.5)).toBe('¥3,600.50')
    expect(formatAmount(0.07)).toBe('¥0.07')
    expect(formatAmount(19.999)).toBe('¥20')
  })

  it('tells a real zero apart from a missing value', () => {
    expect(formatAmount(0)).toBe('¥0')
    expect(formatAmount(null)).toBe('—')
    expect(formatAmount(undefined)).toBe('—')
    expect(formatAmount(Number.NaN)).toBe('—')
  })

  it('keeps the sign of a negative amount in front of the currency mark', () => {
    expect(formatAmount(-800)).toBe('-¥800')
    expect(formatAmount(-0.5)).toBe('-¥0.50')
  })
})

describe('formatCurrency', () => {
  it('always shows the requested decimals', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50')
    expect(formatCurrency(1234.5, 0)).toBe('¥1,235')
  })

  it('falls back to zero for a missing amount', () => {
    expect(formatCurrency(Number.NaN)).toBe('¥0.00')
  })
})

describe('formatDate', () => {
  it('formats valid dates and marks missing ones', () => {
    expect(formatDate('2026-11-15')).toBe('2026-11-15')
    expect(formatDate('2026-11-15', 'MM-DD')).toBe('11-15')
    expect(formatDate(null)).toBe('-')
    expect(formatDate('not a date')).toBe('-')
  })
})
