/**
 * @file stores/appearance.ts
 * @description 江南场景、减少动态与液态玻璃三项外观偏好。主题仍由 stores/theme.ts 管理。
 */
import { create } from 'zustand'

export const APPEARANCE_STORAGE_KEY = 'orange.appearance.v1'

export interface AppearancePreferences {
  /** 在工作台播放雨丝、水波和柳枝动画。 */
  sceneMotion: boolean
  /** 应用内的减少动态开关；与系统的 prefers-reduced-motion 任一为真即生效。 */
  reduceMotion: boolean
  /** 底部导航与摘要使用半透明模糊材质。 */
  liquidGlass: boolean
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  liquidGlass: true,
  reduceMotion: false,
  sceneMotion: true,
}

interface AppearanceState extends AppearancePreferences {
  applyAppearance: () => void
  setPreference: (key: keyof AppearancePreferences, value: boolean) => void
}

const readStoredAppearance = (): AppearancePreferences => {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}')
    if (typeof stored !== 'object' || stored === null) return DEFAULT_APPEARANCE
    const record = stored as Record<string, unknown>
    const pick = (key: keyof AppearancePreferences) =>
      typeof record[key] === 'boolean' ? (record[key] as boolean) : DEFAULT_APPEARANCE[key]
    return {
      liquidGlass: pick('liquidGlass'),
      reduceMotion: pick('reduceMotion'),
      sceneMotion: pick('sceneMotion'),
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  ...readStoredAppearance(),

  applyAppearance() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    // CSS reads these to drop backdrop blur and decorative transitions.
    if (get().liquidGlass) root.removeAttribute('data-glass')
    else root.setAttribute('data-glass', 'solid')
    if (get().reduceMotion) root.setAttribute('data-motion', 'reduced')
    else root.removeAttribute('data-motion')
  },

  setPreference(key, value) {
    set({ [key]: value } as Pick<AppearancePreferences, typeof key>)
    const { liquidGlass, reduceMotion, sceneMotion } = get()
    try {
      window.localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({ liquidGlass, reduceMotion, sceneMotion }),
      )
    } catch {
      // Storage can be unavailable; the preference still applies for this session.
    }
    get().applyAppearance()
  },
}))

/** Applies stored appearance attributes synchronously before React's first render. */
export const applyAppearanceBeforeRender = () => {
  useAppearanceStore.getState().applyAppearance()
}
