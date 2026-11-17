import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { CloudPanel } from './index'

const css = readFileSync(resolve('src/design-system/patterns/cloud-panel/cloud-panel.css'), 'utf8')

describe('CloudPanel', () => {
  it('layers artwork under the content and keeps both decorative layers out of the a11y tree', () => {
    render(
      <CloudPanel aria-label="登录" backdrop={<span data-testid="art" />} padding="md">
        <h1>欢迎回来</h1>
      </CloudPanel>,
    )

    const panel = screen.getByRole('region', { name: '登录' })
    expect(panel).toHaveClass('ods-cloud-panel')
    expect(panel).toHaveAttribute('data-padding', 'md')

    const [pane, rim, content] = Array.from(panel.children)
    expect(pane).toHaveAttribute('data-slot', 'pane')
    expect(pane).toHaveAttribute('aria-hidden', 'true')
    expect(pane).toContainElement(screen.getByTestId('art'))
    expect(rim).toHaveAttribute('aria-hidden', 'true')
    expect(content).toContainElement(screen.getByRole('heading', { name: '欢迎回来' }))
  })

  it('frosts with a veil over a still the page supplies, never with a live backdrop blur', () => {
    expect(css).not.toMatch(/backdrop-filter\s*:/)
    expect(css).toContain('var(--ods-material-frost-veil)')
    expect(css).toContain('var(--cloud-panel-backdrop,')
    expect(css).toMatch(/__pane\s*\{[\s\S]*-webkit-mask-box-image:[^;]*cloud-panel-mask\.svg/)
    expect(css).toMatch(/__rim\s*\{[\s\S]*-webkit-mask-box-image:[^;]*cloud-panel-rim\.svg/)
  })

  it('falls back to round corners where nine-slice masks are unsupported', () => {
    expect(css).toMatch(
      /@supports not \(\(-webkit-mask-box-image: none\) or \(mask-border: none\)\)[\s\S]*border-radius: var\(--ods-radius-lg\)/,
    )
  })
})
