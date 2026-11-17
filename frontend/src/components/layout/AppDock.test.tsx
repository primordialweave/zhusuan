import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@/test/render'
import routerControlsCss from '@/design-system/patterns/router-controls/router-controls.css?raw'
import '@/styles/layout.css'
import AppDock from './AppDock'
import AppLayout from './AppLayout'
import { primaryNavigationItems } from './primaryNavigation'

vi.mock('@wailsio/runtime', () => ({
  Window: { ToggleMaximise: vi.fn().mockResolvedValue(undefined) },
}))

const expectedNavigation = [
  { label: '工作台', path: '/dashboard' },
  { label: '项目管理', path: '/projects' },
  { label: '收款日历', path: '/calendar' },
  { label: '数据分析', path: '/analytics' },
  { label: '系统设置', path: '/settings' },
]

const getCssRules = (rules: CSSRuleList): CSSRule[] =>
  Array.from(rules).flatMap((rule) => {
    if ('cssRules' in rule) return [rule, ...getCssRules((rule as CSSGroupingRule).cssRules)]
    return [rule]
  })

describe('AppDock', () => {
  test('renders the shared primary navigation as one named landmark', () => {
    expect(primaryNavigationItems.map(({ label, path }) => ({ label, path }))).toEqual(
      expectedNavigation,
    )

    render(<AppDock />, { initialEntries: ['/dashboard'] })

    const dock = screen.getByRole('navigation', { name: '主导航' })
    expect(dock).toHaveClass('ods-surface')
    expect(dock).toHaveAttribute('data-radius', 'pill')
    expect(dock).toHaveAttribute('data-variant', 'glass')
    expect(
      within(dock)
        .getAllByRole('link')
        .map((link) => ({ label: link.textContent, path: link.getAttribute('href') })),
    ).toEqual(expectedNavigation)
  })

  test.each([
    ['/dashboard', '工作台'],
    ['/projects/42', '项目管理'],
    ['/projects/edit/42', '项目管理'],
    ['/payment/create', '项目管理'],
    ['/calendar', '收款日历'],
    ['/analytics', '数据分析'],
    ['/settings', '系统设置'],
    ['/design-system', '系统设置'],
  ])('marks only the entry that owns %s as the current page', (pathname, label) => {
    render(<AppDock />, { initialEntries: [pathname] })

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual([label])
  })

  test('hides the decorative icons from assistive technology', () => {
    render(<AppDock />, { initialEntries: ['/dashboard'] })

    for (const link of screen.getAllByRole('link')) {
      expect(link.querySelector('[data-slot="icon"]')).toHaveAttribute('aria-hidden', 'true')
      expect(link.querySelector('[data-slot="label"]')).toHaveTextContent(/\S/)
    }
  })

  test('is rendered once by the application layout', () => {
    render(<AppLayout />, { initialEntries: ['/calendar'] })

    expect(screen.getAllByRole('navigation', { name: '主导航' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: '系统设置' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: '收款日历' })).toHaveAttribute('aria-current', 'page')
  })

  test('keeps the Dock fixed, complete and clickable at any window width', () => {
    // This audits declarations, not rendered geometry; runtime checks cover real window sizes.
    const rules = Array.from(document.styleSheets).flatMap((sheet) => getCssRules(sheet.cssRules))
    const findStyleRule = (selector: string) =>
      rules.find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && rule.selectorText === selector,
      )

    const areaRule = findStyleRule('.app-dock-area')
    const dockRule = findStyleRule('.app-dock')

    expect(areaRule?.style.position).toBe('fixed')
    expect(areaRule?.style.bottom).toContain('env(safe-area-inset-bottom)')
    expect(dockRule?.style.display).toBe('grid')
    expect(dockRule?.style.gridTemplateColumns).toContain('repeat(5')
    expect(dockRule?.style.width).toContain('100vw')
    expect(dockRule?.style.getPropertyValue('--wails-draggable')).toBe('no-drag')
    expect(routerControlsCss).toMatch(
      /\.ods-router-nav-link\[data-appearance='dock'\]:focus-visible\s*\{/,
    )
    expect(routerControlsCss).toMatch(
      /\.ods-router-nav-link\[data-appearance='dock'\]\s*\{[^}]*min-height:\s*44px/,
    )
  })
})
