import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(path), 'utf8')

const scenePageCss = read('src/styles/scene-page.css')
const loginCss = read('src/styles/login.css')
const notFoundCss = read('src/styles/not-found.css')
const pageCss = [scenePageCss, loginCss, notFoundCss].join('\n')

const declaration = (selector: string, property: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(scenePageCss)?.[1]
  return new RegExp(`${property}:\\s*([^;]+);`).exec(rule ?? '')?.[1].replace(/\s+/g, ' ')
}

describe('scene page contract (sign-in and not-found)', () => {
  it('paints the frosted still at exactly the crop of the sharp still behind it', () => {
    const still = declaration('.scene-page__still', 'background')
    const frost = declaration('.scene-page__card', '--cloud-panel-backdrop')
    const crop = '56% 40% / max(120%, calc(100vh * 1.4055)) auto no-repeat'

    expect(still).toBe(`url('../assets/jiangnan/scene.webp') ${crop}`)
    expect(frost).toBe(`url('../assets/jiangnan/scene-frost.webp') ${crop} fixed`)
  })

  it('never transforms the card, which would detach its fixed backdrop from the viewport', () => {
    expect(scenePageCss).not.toMatch(/transform\s*:/)
    expect(scenePageCss).toMatch(
      /@keyframes scene-page-in\s*\{\s*from\s*\{\s*opacity: 0;\s*\}\s*\}/,
    )
    expect(scenePageCss).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.scene-page__card\s*\{\s*animation: scene-page-in/,
    )
  })

  it('keeps the card itself still and never blurs live', () => {
    expect(pageCss).not.toMatch(/infinite/)
    expect(pageCss).not.toMatch(/backdrop-filter\s*:/)
  })

  it('places the greeter with the same crops the two stills use', () => {
    const greeterCss = read('src/styles/scene-greeter.css')

    expect(greeterCss).toMatch(
      /\[data-crop='page'\]\s*\{[^}]*max\(120vw[^}]*--scene-focus-x: 0\.56;[^}]*--scene-focus-y: 0\.4;/,
    )
    expect(greeterCss).toMatch(
      /\[data-crop='cover'\]\s*\{[^}]*max\(100vw[^}]*--scene-focus-x: 0\.5;[^}]*--scene-focus-y: 0\.45;/,
    )
    expect(read('src/styles/scene.css')).toContain('background-position: 50% 45%')
    // A CSS filter softens only the pose that is standing still in WebKit.
    expect(greeterCss).not.toMatch(/(?:^|[;{\s])filter\s*:/)
  })

  it('leaves the card and its controls to ODS', () => {
    expect(pageCss).not.toMatch(/\.ods-/)
    expect(pageCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(loginCss).not.toMatch(/\.login-card(?:[.\s:{]|$)/)
  })
})
