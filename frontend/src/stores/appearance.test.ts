import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Call } from '@wailsio/runtime'
import { resetNativeAppIconSync, type AppIconMode } from '@/utils/appIcon'

vi.mock('@wailsio/runtime', () => ({
  Call: {
    ByName: vi.fn().mockResolvedValue(undefined),
  },
}))

const loadStore = () => import('./appearance')

const preferences = (state: {
  appIcon: AppIconMode
  liquidGlass: boolean
  reduceMotion: boolean
  sceneMotion: boolean
}) => ({
  appIcon: state.appIcon,
  liquidGlass: state.liquidGlass,
  reduceMotion: state.reduceMotion,
  sceneMotion: state.sceneMotion,
})

describe('appearance store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetModules()
    resetNativeAppIconSync()
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-glass')
    document.documentElement.removeAttribute('data-motion')
    document.head.innerHTML = '<link rel="icon" href="/zhusuan.png">'
    delete (window as Window & { _wails?: unknown })._wails
  })

  it('starts from the defaults when nothing is stored', async () => {
    const { DEFAULT_APPEARANCE, useAppearanceStore } = await loadStore()

    expect(preferences(useAppearanceStore.getState())).toEqual(DEFAULT_APPEARANCE)
    expect(DEFAULT_APPEARANCE).toEqual({
      appIcon: 'auto',
      liquidGlass: true,
      reduceMotion: false,
      sceneMotion: true,
    })
  })

  it('restores stored switches and appIcon and falls back per key on a bad value', async () => {
    window.localStorage.setItem(
      'zhusuan.appearance.v1',
      JSON.stringify({
        appIcon: 'dark',
        liquidGlass: false,
        reduceMotion: 'yes',
        sceneMotion: false,
      }),
    )
    const { useAppearanceStore } = await loadStore()

    expect(preferences(useAppearanceStore.getState())).toEqual({
      appIcon: 'dark',
      liquidGlass: false,
      reduceMotion: false,
      sceneMotion: false,
    })
  })

  it('falls back appIcon to auto when stored appIcon is invalid', async () => {
    window.localStorage.setItem(
      'zhusuan.appearance.v1',
      JSON.stringify({ appIcon: 'neon', liquidGlass: true, reduceMotion: false, sceneMotion: true }),
    )
    const { useAppearanceStore } = await loadStore()

    expect(useAppearanceStore.getState().appIcon).toBe('auto')
  })

  it.each(['{not json', 'null', '[1, 2]', '"text"'])(
    'falls back to the defaults for stored %s',
    async (stored) => {
      window.localStorage.setItem('zhusuan.appearance.v1', stored)
      const { DEFAULT_APPEARANCE, useAppearanceStore } = await loadStore()

      expect(preferences(useAppearanceStore.getState())).toEqual(DEFAULT_APPEARANCE)
    },
  )

  it('saves a change at once and reflects it on the root element', async () => {
    const { APPEARANCE_STORAGE_KEY, useAppearanceStore } = await loadStore()

    useAppearanceStore.getState().setPreference('liquidGlass', false)
    useAppearanceStore.getState().setPreference('reduceMotion', true)

    expect(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual({
      appIcon: 'auto',
      liquidGlass: false,
      reduceMotion: true,
      sceneMotion: true,
    })
    expect(document.documentElement).toHaveAttribute('data-glass', 'solid')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')

    useAppearanceStore.getState().setPreference('liquidGlass', true)
    useAppearanceStore.getState().setPreference('reduceMotion', false)

    expect(document.documentElement).not.toHaveAttribute('data-glass')
    expect(document.documentElement).not.toHaveAttribute('data-motion')
  })

  it('persists appIcon mode, updates favicon, and syncs native desktop icon', async () => {
    ;(window as Window & { _wails?: { environment?: { OS?: string } } })._wails = {
      environment: { OS: 'darwin' },
    }
    const { APPEARANCE_STORAGE_KEY, useAppearanceStore } = await loadStore()

    useAppearanceStore.getState().setAppIcon('dark')

    expect(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)!).appIcon).toBe('dark')
    expect(useAppearanceStore.getState().effectiveAppIcon).toBe('dark')
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/zhusuan-dark.png')
    expect(Call.ByName).toHaveBeenCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.AppIconManager.SetAppearance',
      'dark',
    )

    useAppearanceStore.getState().setAppIcon('light')
    expect(useAppearanceStore.getState().effectiveAppIcon).toBe('light')
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/zhusuan.png')
  })

  it('follows system color scheme changes live when appIcon is auto', async () => {
    let matches = false
    const listeners: Array<() => void> = []
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          get matches() {
            return matches
          },
          addEventListener: (_event: string, cb: () => void) => {
            listeners.push(cb)
          },
          removeEventListener: (_event: string, cb: () => void) => {
            const index = listeners.indexOf(cb)
            if (index >= 0) listeners.splice(index, 1)
          },
        }) as unknown as MediaQueryList,
    )

    const { useAppearanceStore } = await loadStore()
    const cleanup = useAppearanceStore.getState().initializeAppearance()
    expect(useAppearanceStore.getState().effectiveAppIcon).toBe('light')

    matches = true
    for (const cb of listeners) cb()
    expect(useAppearanceStore.getState().effectiveAppIcon).toBe('dark')
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/zhusuan-dark.png')

    cleanup()
    expect(listeners).toHaveLength(0)
  })

  it('applies the stored preferences before the first render', async () => {
    window.localStorage.setItem(
      'zhusuan.appearance.v1',
      JSON.stringify({ appIcon: 'dark', liquidGlass: false, reduceMotion: true, sceneMotion: true }),
    )
    const { applyAppearanceBeforeRender } = await loadStore()

    applyAppearanceBeforeRender()

    expect(document.documentElement).toHaveAttribute('data-glass', 'solid')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/zhusuan-dark.png')
  })

  it('still applies a change for the session when storage is unavailable', async () => {
    const { useAppearanceStore } = await loadStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => useAppearanceStore.getState().setPreference('sceneMotion', false)).not.toThrow()
    expect(useAppearanceStore.getState().sceneMotion).toBe(false)
    expect(() => useAppearanceStore.getState().setAppIcon('dark')).not.toThrow()
    expect(useAppearanceStore.getState().appIcon).toBe('dark')
  })
})
