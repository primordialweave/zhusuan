/**
 * @file stores/appearance.ts
 * @description 应用图标、江南场景、减少动态与液态玻璃外观偏好。主题仍由 stores/theme.ts 管理。
 */
import { create } from 'zustand'
import {
  isAppIconMode,
  resolveEffectiveAppIcon,
  syncFavicon,
  syncNativeAppIcon,
  type AppIconMode,
  type EffectiveAppIcon,
} from '@/utils/appIcon'

export type { AppIconMode, EffectiveAppIcon }
export { APP_ICON_OPTIONS } from '@/utils/appIcon'

export const APPEARANCE_STORAGE_KEY = 'zhusuan.appearance.v1'

export type AppearanceToggleKey = 'sceneMotion' | 'reduceMotion' | 'liquidGlass'

export interface AppearancePreferences {
  /** 应用图标外观：浅色、深色或跟随系统。 */
  appIcon: AppIconMode
  /** 在工作台播放雨丝、水波和柳枝动画。 */
  sceneMotion: boolean
  /** 应用内的减少动态开关；与系统的 prefers-reduced-motion 任一为真即生效。 */
  reduceMotion: boolean
  /** 底部导航与摘要使用半透明模糊材质。 */
  liquidGlass: boolean
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  appIcon: 'auto',
  liquidGlass: true,
  reduceMotion: false,
  sceneMotion: true,
}

interface AppearanceState extends AppearancePreferences {
  effectiveAppIcon: EffectiveAppIcon
  initializeAppearance: () => () => void
  applyAppearance: () => void
  setAppIcon: (appIcon: AppIconMode) => void
  setPreference: (key: AppearanceToggleKey, value: boolean) => void
}

const readStoredAppearance = (): AppearancePreferences => {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}')
    if (typeof stored !== 'object' || stored === null) return DEFAULT_APPEARANCE
    const record = stored as Record<string, unknown>
    const pickBool = (key: AppearanceToggleKey) =>
      typeof record[key] === 'boolean' ? (record[key] as boolean) : DEFAULT_APPEARANCE[key]
    return {
      appIcon: isAppIconMode(record.appIcon) ? record.appIcon : DEFAULT_APPEARANCE.appIcon,
      liquidGlass: pickBool('liquidGlass'),
      reduceMotion: pickBool('reduceMotion'),
      sceneMotion: pickBool('sceneMotion'),
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

const persistAppearance = (prefs: AppearancePreferences) => {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage can be unavailable; the preference still applies for this session.
  }
}

const initialAppearance = readStoredAppearance()

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  ...initialAppearance,
  effectiveAppIcon: resolveEffectiveAppIcon(initialAppearance.appIcon),

  initializeAppearance() {
    get().applyAppearance()

    if (typeof window === 'undefined') return () => {}

    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return () => {}

    const handleChange = () => {
      if (get().appIcon === 'auto') {
        get().applyAppearance()
      }
    }

    media.addEventListener('change', handleChange)
    return () => {
      media.removeEventListener('change', handleChange)
    }
  },

  applyAppearance() {
    const effectiveAppIcon = resolveEffectiveAppIcon(get().appIcon)
    if (get().effectiveAppIcon !== effectiveAppIcon) {
      set({ effectiveAppIcon })
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement
      // CSS reads these to drop backdrop blur and decorative transitions.
      if (get().liquidGlass) root.removeAttribute('data-glass')
      else root.setAttribute('data-glass', 'solid')
      if (get().reduceMotion) root.setAttribute('data-motion', 'reduced')
      else root.removeAttribute('data-motion')
    }

    syncFavicon(effectiveAppIcon)
    syncNativeAppIcon(effectiveAppIcon)
  },

  setAppIcon(appIcon) {
    set({ appIcon })
    const { liquidGlass, reduceMotion, sceneMotion } = get()
    persistAppearance({ appIcon, liquidGlass, reduceMotion, sceneMotion })
    get().applyAppearance()
  },

  setPreference(key, value) {
    set({ [key]: value } as Pick<AppearancePreferences, typeof key>)
    const { appIcon, liquidGlass, reduceMotion, sceneMotion } = get()
    persistAppearance({ appIcon, liquidGlass, reduceMotion, sceneMotion })
    get().applyAppearance()
  },
}))

/** Applies stored appearance attributes synchronously before React's first render. */
export const applyAppearanceBeforeRender = () => {
  useAppearanceStore.getState().applyAppearance()
}
