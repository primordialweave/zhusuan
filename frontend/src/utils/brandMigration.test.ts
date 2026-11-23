import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyLegacyPreferences, migrateBrandPreferences } from './brandMigration'

describe('brand preference migration', () => {
  beforeEach(() => {
    localStorage.clear()
    delete (window as Window & { _wails?: unknown })._wails
    vi.unstubAllGlobals()
  })

  it('inherits old appearance keys without overwriting a new preference or importing sessions', () => {
    localStorage.setItem('theme', 'dark')
    applyLegacyPreferences(
      {
        theme: 'light',
        lastUsername: 'test-user',
        'orange.appearance.v1': '{"reduceMotion":true}',
        'zhusuan.themePack.v1': '{"themePack":"winter-harbin","autoHolidayTheme":true}',
        token: 'must-not-migrate',
        password: 'must-not-migrate',
      },
      localStorage,
    )
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(localStorage.getItem('lastUsername')).toBe('test-user')
    expect(localStorage.getItem('zhusuan.appearance.v1')).toBe('{"reduceMotion":true}')
    expect(localStorage.getItem('zhusuan.themePack.v1')).toBe(
      '{"themePack":"winter-harbin","autoHolidayTheme":true}',
    )
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('password')).toBeNull()
  })

  it('moves a copied Windows profile appearance value and does not fetch in browsers', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    localStorage.setItem('orange.appearance.v1', '{"sceneMotion":false}')
    await migrateBrandPreferences()
    expect(localStorage.getItem('zhusuan.appearance.v1')).toBe('{"sceneMotion":false}')
    expect(request).not.toHaveBeenCalled()
  })

  it('reads the private native preference endpoint once before marking migration complete', async () => {
    Object.assign(window, { _wails: { environment: { OS: 'darwin' } } })
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ theme: 'light', rememberPassword: 'true' }),
    })
    vi.stubGlobal('fetch', request)
    await migrateBrandPreferences()
    await migrateBrandPreferences()
    expect(localStorage.getItem('rememberPassword')).toBe('true')
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[0]).toBe('/__zhusuan_migration__/preferences')
  })

  it('keeps a failed migration retryable and allows the login page to start', async () => {
    Object.assign(window, { _wails: { environment: { OS: 'darwin' } } })
    const request = vi.fn().mockRejectedValue(new Error('temporarily locked'))
    vi.stubGlobal('fetch', request)
    await expect(migrateBrandPreferences()).resolves.toBeUndefined()
    request.mockResolvedValue({ ok: true, json: async () => ({ theme: 'dark' }) })
    await migrateBrandPreferences()
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(request).toHaveBeenCalledTimes(2)
  })
})
