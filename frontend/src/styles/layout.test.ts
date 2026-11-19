import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

import './layout.css'
import './scene.css'

const collectRules = (list: CSSRuleList): CSSRule[] =>
  Array.from(list).flatMap((rule) =>
    'cssRules' in rule ? [rule, ...collectRules((rule as CSSGroupingRule).cssRules)] : [rule],
  )

const topLevelRules = Array.from(document.styleSheets).flatMap((sheet) =>
  Array.from(sheet.cssRules),
)
const allRules = Array.from(document.styleSheets).flatMap((sheet) => collectRules(sheet.cssRules))

const findStyleRule = (selector: string) =>
  topLevelRules.find(
    (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText === selector,
  )

const findMediaRule = (condition: string) =>
  topLevelRules.find(
    (rule): rule is CSSMediaRule =>
      rule instanceof CSSMediaRule && rule.conditionText.includes(condition),
  )

describe('desktop shell window interaction boundaries', () => {
  test('keeps one draggable strip across the top for the native window controls', () => {
    const dragRegionRule = findStyleRule('.app-titlebar-drag-region')

    expect(dragRegionRule?.style.position).toBe('fixed')
    expect(dragRegionRule?.style.top).toBe('0px')
    expect(dragRegionRule?.style.left).toBe('0px')
    expect(dragRegionRule?.style.right).toBe('0px')
    expect(dragRegionRule?.style.height).toBe('var(--ods-shell-titlebar-clearance)')
    expect(dragRegionRule?.style.getPropertyValue('--wails-draggable')).toBe('drag')
  })

  test('stacks scene, content, drag strip and Dock in that order', () => {
    const scene = Number(findStyleRule('.jiangnan-scene')?.style.zIndex)
    const content = Number(findStyleRule('.app-main')?.style.zIndex)
    const dragRegion = Number(findStyleRule('.app-titlebar-drag-region')?.style.zIndex)
    const dock = Number(findStyleRule('.app-dock-area')?.style.zIndex)

    expect(scene).toBeLessThan(content)
    expect(content).toBeLessThan(dragRegion)
    expect(dragRegion).toBeLessThan(dock)
  })

  test('never lets the drag strip swallow clicks on shell controls', () => {
    for (const selector of [
      '.app-dock',
      '.app-notification-entry',
      '.app-notification-entry__menu',
    ]) {
      expect(findStyleRule(selector)?.style.getPropertyValue('--wails-draggable'), selector).toBe(
        'no-drag',
      )
    }
    expect(findStyleRule('.app-titlebar-drag-region')?.style.bottom).toBe('')
  })

  test('keeps the scene decorative and out of the way of input', () => {
    const sceneRule = findStyleRule('.jiangnan-scene')

    expect(sceneRule?.style.position).toBe('fixed')
    expect(sceneRule?.style.pointerEvents).toBe('none')
    expect(sceneRule?.style.background).toContain('var(--ods-color-bg-canvas)')
  })

  test('scrolls inside the work surface so the Dock never covers the last row', () => {
    const rootRule = findStyleRule(':root')
    const containerRule = findStyleRule('.app-container')
    const mainRule = findStyleRule('.app-main')
    const clearance = rootRule?.style.getPropertyValue('--app-dock-clearance') ?? ''

    expect(clearance).toContain('var(--ods-shell-dock-height)')
    expect(clearance).toContain('var(--ods-shell-dock-offset)')
    expect(clearance).toContain('env(safe-area-inset-bottom)')
    expect(containerRule?.style.overflow).toBe('hidden')
    expect(mainRule?.style.padding).toContain('var(--app-dock-clearance)')
  })

  test('gives height back to the content in short windows before anything is clipped', () => {
    const shortRule = findMediaRule('max-height: 760px')
    const shortRoot = Array.from(shortRule?.cssRules ?? []).find(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText === ':root',
    )

    expect(shortRule).toBeDefined()
    expect(shortRoot?.style.getPropertyValue('--ods-shell-dock-height')).not.toBe('')
    expect(shortRoot?.style.getPropertyValue('--ods-shell-dock-offset')).not.toBe('')
  })

  test('prints the page content without the shell chrome', () => {
    const printRule = findMediaRule('print')
    const hidden = Array.from(printRule?.cssRules ?? [])
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .filter((rule) => rule.style.display === 'none')
      .map((rule) => rule.selectorText)
      .join(', ')

    expect(hidden).toContain('.app-dock-area')
    expect(hidden).toContain('.app-titlebar-drag-region')
  })

  test('does not recreate button visuals with shell-level native element selectors', () => {
    const visualProperties = [
      'background',
      'border',
      'box-shadow',
      'color',
      'cursor',
      'font-size',
      'padding',
      'width',
    ]
    const bespokeButtonRules = allRules.filter(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.startsWith('.app-') &&
        /(?:^|\s|>)(?:a|button)(?:$|\s|:|\.)/.test(rule.selectorText) &&
        visualProperties.some((property) => rule.style.getPropertyValue(property) !== ''),
    )

    expect(bespokeButtonRules.map((rule) => rule.selectorText)).toEqual([])
  })

  test('retires the top bar, its theme popover and the pointer light', () => {
    const selectors = allRules
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .map((rule) => rule.selectorText)
      .join('\n')

    expect(selectors).not.toMatch(/\.app-topbar|\.theme-selector|\.app-background/)
  })

  test('keeps the project list header and pagination in place while only the rows scroll', () => {
    const projectCss = readFileSync(resolve('src/styles/project-domain.css'), 'utf8')
    const projectsSource = readFileSync(resolve('src/views/ProjectsView.tsx'), 'utf8')
    const block = (selector: string) =>
      new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(projectCss)?.[1] ?? ''

    expect(block('.projects-view')).toContain('min-height: 0')
    expect(block('.projects-workspace')).toContain('flex: 1 1 0')
    expect(block('.project-table-scroll')).toContain('overflow-y: auto')
    expect(projectsSource).toMatch(/<Table\.Root[^>]*\bstickyHeader\b/s)
    expect(projectsSource).toContain('wrapperClassName="project-table-scroll"')
  })
})
