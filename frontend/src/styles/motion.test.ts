import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import './motion.css'

const designSystemMotion = readFileSync(resolve('src/design-system/foundations/motion.css'), 'utf8')
const featureMotion = readFileSync(resolve('src/styles/motion.css'), 'utf8')
const layoutCss = readFileSync(resolve('src/styles/layout.css'), 'utf8')
const appSource = readFileSync(resolve('src/App.tsx'), 'utf8')
const layoutSource = readFileSync(resolve('src/components/layout/AppLayout.tsx'), 'utf8')

describe('reduced motion foundations', () => {
  const reducedMotionRule = Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule && rule.conditionText === '(prefers-reduced-motion: reduce)',
    )

  it('delegates global motion compression to the design-system foundation', () => {
    expect(designSystemMotion).toContain('animation-duration: 0.01ms')
    expect(designSystemMotion).toContain('animation-iteration-count: 1')
    expect(featureMotion).not.toMatch(/\*,\s*\*::before,\s*\*::after/)
  })

  it('compresses motion for the in-app preference exactly as for the system setting', () => {
    const inAppRule = designSystemMotion.match(
      /:root\[data-motion='reduced'\] \*,[\s\S]*?\{(?<body>[^}]*)\}/,
    )?.groups?.body

    expect(inAppRule).toContain('animation-duration: 0.01ms !important')
    expect(inAppRule).toContain('animation-iteration-count: 1 !important')
    expect(inAppRule).toContain('transition-duration: 0.01ms !important')
  })

  it('has no pointer-tracking light left to freeze', () => {
    expect(existsSync(resolve('src/hooks/useAmbientLight.ts'))).toBe(false)
    expect(`${featureMotion}\n${layoutCss}`).not.toMatch(/--light-[xy]/)
    expect(`${appSource}\n${layoutSource}`).not.toMatch(/pointermove|mousemove/)
    expect(reducedMotionRule?.cssText).not.toContain('liquid-glass')
  })

  it('uses near-instant transitions instead of removing state and focus feedback', () => {
    expect(designSystemMotion).toContain('transition-duration: 0.01ms')
    expect(`${designSystemMotion}\n${featureMotion}`).not.toContain('transition: none')
  })

  it('neutralizes ambient and entrance transforms while retaining a fade response', () => {
    const rules = Array.from(reducedMotionRule?.cssRules ?? [])
    const continuousMotionRule = rules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && rule.selectorText.includes('data-motion="continuous"'),
    )
    const entranceRule = rules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && rule.selectorText.includes('data-motion="entrance"'),
    )

    expect(continuousMotionRule?.style.animation).toBe('none')
    expect(continuousMotionRule?.style.transform).toBe('none')
    expect(entranceRule?.style.animation).toContain('ember-fade-in')
    expect(entranceRule?.style.transform).toBe('none')
  })
})
