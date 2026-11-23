/**
 * @file stores/theme.ts
 * @description React/Zustand dual-axis theme state: Light/Dark mode × Scenic Theme Pack.
 */
import { create } from 'zustand'
import {
  DEFAULT_THEME_PACK,
  isThemePackSelection,
  loadThemePackAssets,
  type ConcreteThemePackId,
  type ThemePackSelection,
} from '@/config/themes'
import {
  getActiveHolidayWindow,
  resolveEffectiveThemePack,
  type HolidayWindow,
} from '@/utils/themeCalendar'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type EffectiveTheme = 'light' | 'dark'
export type { ConcreteThemePackId, ThemePackSelection }

export const THEME_PACK_STORAGE_KEY = 'zhusuan.themePack.v1'

export interface StoredThemePackPreferences {
  autoHolidayTheme: boolean
  dismissedHolidayId: string | null
  themePack: ThemePackSelection
}

export const DEFAULT_THEME_PACK_PREFERENCES: StoredThemePackPreferences = {
  autoHolidayTheme: true,
  dismissedHolidayId: null,
  themePack: DEFAULT_THEME_PACK,
}

export const THEME_OPTIONS: ReadonlyArray<{
  label: string
  value: ThemeMode
}> = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'auto' },
]

export const getThemeModeLabel = (theme: ThemeMode) =>
  THEME_OPTIONS.find((option) => option.value === theme)?.label ?? '跟随系统'

interface ThemeState {
  activeHoliday: HolidayWindow | null
  autoHolidayTheme: boolean
  dismissedHolidayId: string | null
  effectiveTheme: EffectiveTheme
  effectiveThemePack: ConcreteThemePackId
  theme: ThemeMode
  themePack: ThemePackSelection
  applyTheme: (transition?: boolean) => void
  initializeTheme: () => () => void
  setAutoHolidayTheme: (enabled: boolean) => void
  setTheme: (theme: ThemeMode) => void
  setThemePack: (pack: ThemePackSelection) => void
  toggleTheme: () => void
}

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'auto'

const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'auto'
  const stored = window.localStorage.getItem('theme')
  return isThemeMode(stored) ? stored : 'auto'
}

const getStoredThemePackPreferences = (): StoredThemePackPreferences => {
  if (typeof window === 'undefined') return { ...DEFAULT_THEME_PACK_PREFERENCES }
  try {
    const raw = window.localStorage.getItem(THEME_PACK_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_THEME_PACK_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<StoredThemePackPreferences>
    return {
      autoHolidayTheme:
        typeof parsed.autoHolidayTheme === 'boolean'
          ? parsed.autoHolidayTheme
          : DEFAULT_THEME_PACK_PREFERENCES.autoHolidayTheme,
      dismissedHolidayId:
        typeof parsed.dismissedHolidayId === 'string' && parsed.dismissedHolidayId.length > 0
          ? parsed.dismissedHolidayId
          : null,
      themePack: isThemePackSelection(parsed.themePack)
        ? parsed.themePack
        : DEFAULT_THEME_PACK_PREFERENCES.themePack,
    }
  } catch {
    return { ...DEFAULT_THEME_PACK_PREFERENCES }
  }
}

const persistThemePackPreferences = (prefs: StoredThemePackPreferences) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_PACK_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage quota or privacy mode should never break interactive theme switches.
  }
}

const resolveEffectiveTheme = (theme: ThemeMode): EffectiveTheme => {
  if (theme !== 'auto') return theme
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Keep synchronized with --ods-duration-fast (200ms) in design-system/tokens/semantic.css.
export const THEME_TRANSITION_DURATION = 200
let transitionTimer: number | undefined

const clearThemeTransition = () => {
  if (transitionTimer !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(transitionTimer)
  }
  transitionTimer = undefined
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('theme-transitioning')
  }
}

const startThemeTransition = () => {
  clearThemeTransition()
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.getAttribute('data-motion') === 'reduced'
  ) {
    return
  }

  document.documentElement.classList.add('theme-transitioning')
  transitionTimer = window.setTimeout(clearThemeTransition, THEME_TRANSITION_DURATION)
}

const initialTheme = getStoredTheme()
const initialPackPrefs = getStoredThemePackPreferences()
const initialDate = new Date()
const initialResolvedPack = resolveEffectiveThemePack({
  autoHolidayTheme: initialPackPrefs.autoHolidayTheme,
  dismissedHolidayId: initialPackPrefs.dismissedHolidayId,
  now: initialDate,
  selection: initialPackPrefs.themePack,
})

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeHoliday: initialResolvedPack.activeHoliday,
  autoHolidayTheme: initialPackPrefs.autoHolidayTheme,
  dismissedHolidayId: initialPackPrefs.dismissedHolidayId,
  effectiveTheme: resolveEffectiveTheme(initialTheme),
  effectiveThemePack: initialResolvedPack.packId,
  theme: initialTheme,
  themePack: initialPackPrefs.themePack,

  initializeTheme() {
    get().applyTheme(false)

    if (typeof window === 'undefined') return () => {}

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (get().theme === 'auto') {
        get().applyTheme(true)
      }
    }

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined' || document.hidden) return
      const state = get()
      const resolved = resolveEffectiveThemePack({
        autoHolidayTheme: state.autoHolidayTheme,
        dismissedHolidayId: state.dismissedHolidayId,
        now: new Date(),
        selection: state.themePack,
      })
      const holidayChanged =
        resolved.activeHoliday?.instanceId !== state.activeHoliday?.instanceId
      if (resolved.packId !== state.effectiveThemePack || holidayChanged) {
        state.applyTheme(resolved.packId !== state.effectiveThemePack)
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'theme' && event.key !== THEME_PACK_STORAGE_KEY && event.key !== null) {
        return
      }
      const nextTheme = getStoredTheme()
      const nextPackPrefs = getStoredThemePackPreferences()
      set({
        autoHolidayTheme: nextPackPrefs.autoHolidayTheme,
        dismissedHolidayId: nextPackPrefs.dismissedHolidayId,
        theme: nextTheme,
        themePack: nextPackPrefs.themePack,
      })
      get().applyTheme(true)
    }

    const handleDayChanged = () => {
      const state = get()
      const resolved = resolveEffectiveThemePack({
        autoHolidayTheme: state.autoHolidayTheme,
        dismissedHolidayId: state.dismissedHolidayId,
        now: new Date(),
        selection: state.themePack,
      })
      if (
        resolved.packId !== state.effectiveThemePack ||
        resolved.activeHoliday?.instanceId !== state.activeHoliday?.instanceId
      ) {
        state.applyTheme(true)
      }
    }

    media.addEventListener('change', handleChange)
    window.addEventListener('storage', handleStorage)
    window.addEventListener('zhusuan:day-changed', handleDayChanged)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    return () => {
      media.removeEventListener('change', handleChange)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('zhusuan:day-changed', handleDayChanged)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
      clearThemeTransition()
    }
  },

  applyTheme(transition = false) {
    const state = get()
    const now = new Date()
    const effectiveTheme = resolveEffectiveTheme(state.theme)
    const { activeHoliday, packId: effectiveThemePack } = resolveEffectiveThemePack({
      autoHolidayTheme: state.autoHolidayTheme,
      dismissedHolidayId: state.dismissedHolidayId,
      now,
      selection: state.themePack,
    })

    if (transition) startThemeTransition()
    set({ activeHoliday, effectiveTheme, effectiveThemePack })

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', effectiveTheme)
      document.documentElement.setAttribute('data-theme-pack', effectiveThemePack)
      // WKWebView can leave descendants that consume inherited custom
      // properties on the previous composited frame until the window resizes.
      // Rebuilding body layout in the same task invalidates that stale frame;
      // the browser cannot paint the temporary display:none state.
      if (transition && document.body) {
        const previousDisplay = document.body.style.display
        const scrollX = window.scrollX
        const scrollY = window.scrollY
        document.body.style.display = 'none'
        void document.body.offsetHeight
        document.body.style.display = previousDisplay
        if (scrollX !== 0 || scrollY !== 0) {
          window.scrollTo(scrollX, scrollY)
        }
      }
    }
  },

  setTheme(theme) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme)
    }

    set({ theme })
    get().applyTheme(true)
  },

  setThemePack(themePack) {
    const state = get()
    const activeHoliday = getActiveHolidayWindow(new Date())
    const isHolidaySelection = themePack.startsWith('holiday-')
    // If the user explicitly picks a non-holiday theme during an active holiday,
    // dismiss that holiday instance so their manual pick takes effect immediately.
    const dismissedHolidayId =
      activeHoliday && !isHolidaySelection
        ? activeHoliday.instanceId
        : isHolidaySelection
          ? null
          : state.dismissedHolidayId

    persistThemePackPreferences({
      autoHolidayTheme: state.autoHolidayTheme,
      dismissedHolidayId,
      themePack,
    })

    set({ dismissedHolidayId, themePack })
    get().applyTheme(true)
  },

  setAutoHolidayTheme(autoHolidayTheme) {
    const state = get()
    const dismissedHolidayId = autoHolidayTheme ? null : state.dismissedHolidayId
    persistThemePackPreferences({
      autoHolidayTheme,
      dismissedHolidayId,
      themePack: state.themePack,
    })

    set({ autoHolidayTheme, dismissedHolidayId })
    get().applyTheme(true)
  },

  toggleTheme() {
    get().setTheme(get().effectiveTheme === 'dark' ? 'light' : 'dark')
  },
}))

/** Applies the persisted/system theme synchronously before React's first render and warms active pack assets. */
export const applyThemeBeforeRender = () => {
  const store = useThemeStore.getState()
  store.applyTheme(false)
  void loadThemePackAssets(useThemeStore.getState().effectiveThemePack)
}
