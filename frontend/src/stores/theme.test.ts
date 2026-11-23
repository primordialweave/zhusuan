import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_THEME_PACK_PREFERENCES,
  THEME_OPTIONS,
  THEME_PACK_STORAGE_KEY,
  THEME_TRANSITION_DURATION,
  useThemeStore,
} from './theme'

interface MediaController {
  dispatchSystemTheme: (dark: boolean) => void
  listenerCount: () => number
  setReducedMotion: (reduced: boolean) => void
}

const installMatchMedia = (initialDark = false): MediaController => {
  let systemDark = initialDark
  let reducedMotion = false
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => {
      const queryListeners = listeners.get(query) ?? new Set()
      listeners.set(query, queryListeners)
      return {
        matches: query.includes('prefers-reduced-motion') ? reducedMotion : systemDark,
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          queryListeners.add(listener),
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          queryListeners.delete(listener),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
  )

  return {
    dispatchSystemTheme(dark) {
      systemDark = dark
      listeners
        .get('(prefers-color-scheme: dark)')
        ?.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent))
    },
    listenerCount: () => listeners.get('(prefers-color-scheme: dark)')?.size ?? 0,
    setReducedMotion(reduced) {
      reducedMotion = reduced
    },
  }
}

describe('theme store', () => {
  let cleanupThemeListener: (() => void) | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0))
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme-pack')
    document.documentElement.classList.remove('theme-transitioning')
    useThemeStore.setState({
      activeHoliday: null,
      autoHolidayTheme: DEFAULT_THEME_PACK_PREFERENCES.autoHolidayTheme,
      dismissedHolidayId: null,
      effectiveTheme: 'light',
      effectiveThemePack: 'spring-jiangnan',
      theme: 'auto',
      themePack: DEFAULT_THEME_PACK_PREFERENCES.themePack,
    })
  })

  afterEach(() => {
    cleanupThemeListener?.()
    cleanupThemeListener = undefined
    act(() => vi.runOnlyPendingTimers())
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    document.body.style.display = ''
    document.documentElement.classList.remove('theme-transitioning')
  })

  it('shares the three product theme modes and labels', () => {
    expect(THEME_OPTIONS).toEqual([
      { label: '浅色', value: 'light' },
      { label: '深色', value: 'dark' },
      { label: '跟随系统', value: 'auto' },
    ])
  })

  it('persists explicit and automatic theme modes', () => {
    installMatchMedia()

    useThemeStore.getState().setTheme('dark')
    expect(window.localStorage.getItem('theme')).toBe('dark')
    useThemeStore.getState().setTheme('auto')

    expect(window.localStorage.getItem('theme')).toBe('auto')
  })

  it('follows system changes only in auto mode', () => {
    const media = installMatchMedia(false)
    cleanupThemeListener = useThemeStore.getState().initializeTheme()

    expect(useThemeStore.getState().effectiveTheme).toBe('light')
    act(() => media.dispatchSystemTheme(true))
    expect(useThemeStore.getState().effectiveTheme).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    useThemeStore.getState().setTheme('light')
    act(() => media.dispatchSystemTheme(false))
    act(() => media.dispatchSystemTheme(true))

    expect(useThemeStore.getState().effectiveTheme).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('adds a short root transition for interactive changes and resets rapid switches', () => {
    installMatchMedia(false)

    useThemeStore.getState().setTheme('dark')
    expect(document.documentElement).toHaveClass('theme-transitioning')

    act(() => vi.advanceTimersByTime(180))
    useThemeStore.getState().setTheme('light')
    act(() => vi.advanceTimersByTime(THEME_TRANSITION_DURATION - 1))
    expect(document.documentElement).toHaveClass('theme-transitioning')

    act(() => vi.advanceTimersByTime(1))
    expect(document.documentElement).not.toHaveClass('theme-transitioning')
  })

  it('rebuilds the body layout after changing the root theme for WebKit', () => {
    installMatchMedia(false)
    document.body.style.display = 'block'
    const layoutRead = vi.spyOn(document.body, 'offsetHeight', 'get')
    layoutRead.mockClear()
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 24 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 960 })
    const restoreScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    useThemeStore.getState().setTheme('dark')

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(layoutRead).toHaveBeenCalled()
    expect(document.body.style.display).toBe('block')
    expect(restoreScroll).toHaveBeenCalledWith(24, 960)
  })

  it('does not animate the initial application or reduced-motion changes', () => {
    const media = installMatchMedia(true)
    const initialLayoutRead = vi.spyOn(document.body, 'offsetHeight', 'get')
    initialLayoutRead.mockClear()

    cleanupThemeListener = useThemeStore.getState().initializeTheme()
    expect(initialLayoutRead).not.toHaveBeenCalled()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).not.toHaveClass('theme-transitioning')

    media.setReducedMotion(true)
    useThemeStore.getState().setTheme('light')
    expect(document.documentElement).not.toHaveClass('theme-transitioning')
  })

  it('does not animate a theme change while the in-app reduced-motion preference is on', () => {
    installMatchMedia(false)
    document.documentElement.setAttribute('data-motion', 'reduced')

    try {
      useThemeStore.getState().setTheme('dark')
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
      expect(document.documentElement).not.toHaveClass('theme-transitioning')
    } finally {
      document.documentElement.removeAttribute('data-motion')
    }
  })

  it('removes the media listener and pending transition during cleanup', () => {
    const media = installMatchMedia(false)
    cleanupThemeListener = useThemeStore.getState().initializeTheme()
    expect(media.listenerCount()).toBe(1)

    useThemeStore.getState().setTheme('dark')
    expect(document.documentElement).toHaveClass('theme-transitioning')
    cleanupThemeListener()
    cleanupThemeListener = undefined

    expect(media.listenerCount()).toBe(0)
    expect(document.documentElement).not.toHaveClass('theme-transitioning')
  })

  it('persists scenic theme packs and applies data-theme-pack alongside data-theme', () => {
    installMatchMedia(false)

    useThemeStore.getState().setThemePack('winter-harbin')
    expect(useThemeStore.getState().themePack).toBe('winter-harbin')
    expect(useThemeStore.getState().effectiveThemePack).toBe('winter-harbin')
    expect(document.documentElement).toHaveAttribute('data-theme-pack', 'winter-harbin')
    expect(JSON.parse(window.localStorage.getItem(THEME_PACK_STORAGE_KEY)!)).toEqual({
      autoHolidayTheme: true,
      dismissedHolidayId: null,
      themePack: 'winter-harbin',
    })
  })

  it('resolves seasonal packs automatically when auto-season is active', () => {
    installMatchMedia(false)
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0)) // Nov 20 -> winter

    useThemeStore.getState().setThemePack('auto-season')
    expect(useThemeStore.getState().effectiveThemePack).toBe('winter-harbin')
    expect(document.documentElement).toHaveAttribute('data-theme-pack', 'winter-harbin')

    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0)) // Jul 15 -> summer
    useThemeStore.getState().applyTheme(false)
    expect(useThemeStore.getState().effectiveThemePack).toBe('summer-westlake')
  })

  it('auto-activates holiday themes during festival windows and respects manual override', () => {
    installMatchMedia(false)
    vi.setSystemTime(new Date(2026, 1, 17, 12, 0, 0)) // 2026 Chinese New Year day

    useThemeStore.getState().applyTheme(false)
    expect(useThemeStore.getState().effectiveThemePack).toBe('holiday-spring-festival')
    expect(useThemeStore.getState().activeHoliday?.instanceId).toBe('2026:holiday-spring-festival')

    // Picking a non-holiday theme during the festival dismisses this festival instance.
    useThemeStore.getState().setThemePack('autumn-forbidden')
    expect(useThemeStore.getState().effectiveThemePack).toBe('autumn-forbidden')
    expect(useThemeStore.getState().dismissedHolidayId).toBe('2026:holiday-spring-festival')

    // Re-enabling autoHolidayTheme clears the dismissal and restores the active holiday.
    useThemeStore.getState().setAutoHolidayTheme(false)
    expect(useThemeStore.getState().effectiveThemePack).toBe('autumn-forbidden')
    useThemeStore.getState().setAutoHolidayTheme(true)
    expect(useThemeStore.getState().effectiveThemePack).toBe('holiday-spring-festival')
  })

  it('refreshes seasonal and holiday themes on visibilitychange after midnight rollover', () => {
    installMatchMedia(false)
    vi.setSystemTime(new Date(2026, 1, 15, 23, 55, 0)) // Day before 2026 Spring Festival Eve
    cleanupThemeListener = useThemeStore.getState().initializeTheme()
    expect(useThemeStore.getState().effectiveThemePack).toBe('spring-jiangnan')

    // App wakes up on Spring Festival Eve
    vi.setSystemTime(new Date(2026, 1, 16, 8, 0, 0))
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(useThemeStore.getState().effectiveThemePack).toBe('holiday-spring-festival')
    expect(document.documentElement).toHaveAttribute('data-theme-pack', 'holiday-spring-festival')
  })
})
