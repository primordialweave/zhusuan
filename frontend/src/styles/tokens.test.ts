import { afterEach, describe, expect, it } from 'vitest'

import '@/design-system/tokens/reference.css'
import '@/design-system/tokens/semantic.css'
import '@/design-system/tokens/themes/jiangnan-mist.css'
import '@/design-system/tokens/themes/jiangnan-night.css'

describe('Orange Design System tokens', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  const tokenValue = (token: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(token).trim()

  it('provides 烟雨 as the safe default', () => {
    document.documentElement.removeAttribute('data-theme')

    expect(tokenValue('--ods-ref-color-mist-50')).toBe('#e7efe8')
    expect(tokenValue('--ods-color-bg-canvas')).toBe(tokenValue('--ods-ref-color-mist-50'))
    expect(tokenValue('--ods-color-fg-default')).toBe(tokenValue('--ods-ref-color-jade-900'))
    expect(tokenValue('--ods-color-accent-text')).toBe(tokenValue('--ods-ref-color-jade-700'))
  })

  it('provides the complete 夜雨 theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark')

    expect(tokenValue('--ods-color-bg-canvas')).toBe(tokenValue('--ods-ref-color-mist-900'))
    expect(tokenValue('--ods-color-accent')).toBe(tokenValue('--ods-ref-color-jade-400'))
    expect(tokenValue('--ods-color-fg-default')).toBe('#e5f2e9')
    expect(tokenValue('--ods-color-accent-text')).toBe(tokenValue('--ods-ref-color-jade-300'))
  })

  it('publishes semantic spacing, geometry, and motion contracts', () => {
    expect(tokenValue('--ods-space-6')).toBe(tokenValue('--ods-ref-space-6'))
    expect(tokenValue('--ods-radius-control')).toBe(tokenValue('--ods-ref-radius-10'))
    expect(tokenValue('--ods-duration-instant')).toBe(tokenValue('--ods-ref-duration-140'))
    expect(tokenValue('--ods-duration-press')).toBe(tokenValue('--ods-ref-duration-160'))
    expect(tokenValue('--ods-duration-release')).toBe(tokenValue('--ods-ref-duration-100'))
    expect(tokenValue('--ods-ref-ease-in-out')).toBe('cubic-bezier(0.77, 0, 0.175, 1)')
    expect(tokenValue('--ods-ease-in-out')).toBe(tokenValue('--ods-ref-ease-in-out'))
    expect(tokenValue('--ods-ease-standard')).toBe(tokenValue('--ods-ref-ease-standard'))
  })

  it('does not expose retired aliases', () => {
    expect(tokenValue('--color-bg')).toBe('')
    expect(tokenValue('--space-5')).toBe('')
    expect(tokenValue('--motion-instant')).toBe('')
    expect(tokenValue('--text-primary')).toBe('')
  })
})
