import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import './styles.css'

const styles = readFileSync(resolve('src/design-system/styles.css'), 'utf8')

describe('Orange Design System stylesheet entry', () => {
  it('declares one deterministic cascade order', () => {
    expect(styles).toContain(
      '@layer reset, vendor, theme, tokens, base, components, patterns, utilities, overrides;',
    )
  })

  it('registers that order before Tailwind so reset cannot override component colors', () => {
    const appStyles = readFileSync(resolve('src/assets/main.css'), 'utf8')
    const declaration = styles.match(/@layer[^;]+;/)![0]
    expect(appStyles).toContain(declaration)
    expect(appStyles.indexOf(declaration)).toBeLessThan(appStyles.indexOf("@import 'tailwindcss'"))
  })

  it('imports tokens before foundations in the approved order', () => {
    const imports = Array.from(styles.matchAll(/@import\s+['"]([^'"]+)['"]/g), (match) => match[1])

    expect(imports).toEqual([
      './tokens/reference.css',
      './tokens/semantic.css',
      './tokens/themes/jiangnan-mist.css',
      './tokens/themes/jiangnan-night.css',
      './tokens/themes/packs/summer-westlake.css',
      './tokens/themes/packs/autumn-forbidden.css',
      './tokens/themes/packs/winter-harbin.css',
      './tokens/themes/packs/holiday-spring-festival.css',
      './tokens/themes/packs/holiday-mid-autumn.css',
      './foundations/reset.css',
      './foundations/typography.css',
      './foundations/focus.css',
      './foundations/motion.css',
      './foundations/accessibility.css',
      './components.css',
    ])
  })

  it('does not duplicate Tailwind or import legacy bundles', () => {
    expect(styles).not.toMatch(/@import\s+['"]tailwindcss['"]/)
    expect(styles).not.toMatch(/assets\/(?:main|liquid-glass)\.css/)
  })
})
