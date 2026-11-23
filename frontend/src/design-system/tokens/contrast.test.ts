import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Color = [number, number, number, number]
const definitions = (source: string) =>
  new Map(
    [...source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  )
const reference = definitions(readFileSync('src/design-system/tokens/reference.css', 'utf8'))
const luminance = (color: Color) =>
  color.slice(0, 3).reduce((sum, value, index) => {
    const channel = value / 255
    return (
      sum +
      (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][index]
    )
  }, 0)
const over = (foreground: Color, background: Color): Color => [
  foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
  foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
  foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
  1,
]
const contrast = (a: Color, b: Color) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (values[1] + 0.05) / (values[0] + 0.05)
}

const extractBlock = (source: string, mode: 'light' | 'dark') => {
  const marker = `[data-theme='${mode}']`
  const start = source.indexOf(marker)
  if (start === -1) return ''
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  return open !== -1 && close !== -1 ? source.slice(open + 1, close) : ''
}

const themeVariants: ReadonlyArray<{
  base: 'jiangnan-mist' | 'jiangnan-night'
  label: string
  mode: 'light' | 'dark'
  pack?: string
}> = [
  { base: 'jiangnan-mist', label: 'jiangnan-mist (spring-jiangnan)', mode: 'light' },
  { base: 'jiangnan-night', label: 'jiangnan-night (spring-jiangnan)', mode: 'dark' },
  ...[
    'summer-westlake',
    'autumn-forbidden',
    'winter-harbin',
    'holiday-spring-festival',
    'holiday-mid-autumn',
  ].flatMap((pack) => [
    { base: 'jiangnan-mist' as const, label: `${pack} (light)`, mode: 'light' as const, pack },
    { base: 'jiangnan-night' as const, label: `${pack} (dark)`, mode: 'dark' as const, pack },
  ]),
]

describe.each(themeVariants)('$label readable colors', ({ base, mode, pack }) => {
  const packDefinitions = pack
    ? definitions(
        extractBlock(readFileSync(`src/design-system/tokens/themes/packs/${pack}.css`, 'utf8'), mode),
      )
    : new Map<string, string>()
  const tokens = new Map([
    ...reference,
    ...definitions(readFileSync(`src/design-system/tokens/themes/${base}.css`, 'utf8')),
    ...packDefinitions,
  ])
  const resolve = (value: string): string =>
    value.replace(/var\((--[\w-]+)\)/g, (_, key: string) => resolve(tokens.get(key) ?? ''))
  const color = (value: string): Color => {
    const resolved = resolve(value)
    if (/^#[0-9a-f]{6}$/i.test(resolved))
      return [1, 3, 5]
        .map((index) => Number.parseInt(resolved.slice(index, index + 2), 16))
        .concat(1) as Color
    const rgba = /^rgba?\(([^)]+)\)$/.exec(resolved)?.[1].split(',').map(Number)
    if (!rgba) throw new Error(`Unsupported color: ${resolved}`)
    return [rgba[0], rgba[1], rgba[2], rgba[3] ?? 1]
  }
  const tokenColor = (key: string) => color(`var(${key})`)
  const canvas = tokenColor('--ods-color-bg-canvas')
  const surface = over(tokenColor('--ods-color-bg-surface-raised'), canvas)

  it('keeps small foreground text readable on content surfaces', () => {
    for (const token of [
      '--ods-color-fg-default',
      '--ods-color-fg-muted',
      '--ods-color-fg-subtle',
      '--ods-color-accent-text',
    ]) {
      expect(contrast(over(tokenColor(token), surface), surface), token).toBeGreaterThanOrEqual(4.5)
    }
    const soft = over(tokenColor('--ods-color-accent-soft'), surface)
    expect(contrast(tokenColor('--ods-color-accent-text'), soft)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the foreground readable across every brand gradient stop', () => {
    const stops = resolve(tokens.get('--ods-gradient-glow')!).match(/#[0-9a-f]{6}/gi)!
    for (const stop of stops) {
      expect(
        contrast(tokenColor('--ods-color-accent-fg'), color(stop)),
        stop,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps text readable on frost over the darkest and brightest parts of the scene', () => {
    // Extremes of scene-frost.webp in the half of the window where a frosted panel sits.
    const backdrops: Color[] = [
      [127, 147, 124, 1],
      [226, 232, 225, 1],
    ]
    for (const backdrop of backdrops) {
      const pane = over(tokenColor('--ods-material-frost-veil'), backdrop)
      const control = over(tokenColor('--ods-material-frost-control'), pane)
      for (const token of [
        '--ods-color-fg-default',
        '--ods-color-fg-muted',
        '--ods-color-fg-subtle',
        '--ods-color-accent-text',
      ]) {
        expect(contrast(tokenColor(token), pane), `${token} on frost`).toBeGreaterThanOrEqual(4.5)
      }
      // In-field text is the field's only label on the sign-in card.
      for (const token of ['--ods-color-fg-default', '--ods-color-fg-subtle']) {
        expect(
          contrast(tokenColor(token), control),
          `${token} in a control on frost`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps status text readable on its tinted surface', () => {
    for (const tone of ['success', 'warning', 'danger', 'info']) {
      const background = over(tokenColor(`--ods-color-status-${tone}-soft`), surface)
      expect(
        contrast(tokenColor(`--ods-color-status-${tone}`), background),
        tone,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps jade icon strokes and on-accent carved icons clearly legible on every surface', () => {
    for (const token of [
      '--ods-material-jade-icon-base',
      '--ods-material-jade-icon-edge',
      '--ods-material-jade-icon-depth',
    ]) {
      expect(contrast(tokenColor(token), surface), `${token} on surface`).toBeGreaterThanOrEqual(3)
    }

    const accentGradients = ['--ods-gradient-glow', '--ods-gradient-nav-selected']
    for (const gradientToken of accentGradients) {
      const stops = resolve(tokens.get(gradientToken)!).match(/#[0-9a-f]{6}/gi)!
      for (const stop of stops) {
        for (const iconToken of [
          '--ods-material-jade-icon-on-accent-base',
          '--ods-material-jade-icon-on-accent-edge',
          '--ods-material-jade-icon-on-accent-depth',
        ]) {
          expect(
            contrast(tokenColor(iconToken), color(stop)),
            `${iconToken} on ${gradientToken} ${stop}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})
