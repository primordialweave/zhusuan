/**
 * @file config/themes.ts
 * @description Registry for seasonal & holiday scenic theme packs with lazy asset loading.
 */
import jiangnanBusinessUrl from '@/assets/jiangnan/scene-business.webp'
import jiangnanFrostUrl from '@/assets/jiangnan/scene-frost.webp'
import jiangnanMasksUrl from '@/assets/jiangnan/scene-masks.webp'
import jiangnanSceneUrl from '@/assets/jiangnan/scene.webp'
import autumnThumbUrl from '@/assets/themes/autumn-forbidden/thumb.webp'
import midAutumnThumbUrl from '@/assets/themes/holiday-mid-autumn/thumb.webp'
import springFestivalThumbUrl from '@/assets/themes/holiday-spring-festival/thumb.webp'
import springThumbUrl from '@/assets/themes/spring-jiangnan/thumb.webp'
import summerThumbUrl from '@/assets/themes/summer-westlake/thumb.webp'
import winterThumbUrl from '@/assets/themes/winter-harbin/thumb.webp'
import type { SceneParticlePreset } from '@/scene/renderAtmosphere2D'
import type { SceneGLOptions } from '@/scene/renderSceneGL'
import type {
  ConcreteThemePackId,
  HolidayThemePackId,
  SeasonThemePackId,
  ThemePackSelection,
} from '@/utils/themeCalendar'

export type {
  ConcreteThemePackId,
  HolidayThemePackId,
  SeasonThemePackId,
  ThemePackSelection,
}

export interface ThemePackAssets {
  businessUrl: string
  frostUrl: string
  masksUrl: string
  sceneUrl: string
}

export interface ThemePackMeta {
  badge?: string
  category: 'season' | 'holiday'
  glOptions: SceneGLOptions
  /** Whether the waving greeter figure sits on the Jiangnan bridge in this painting. */
  hasGreeter: boolean
  id: ConcreteThemePackId
  label: string
  location: string
  particlePreset: SceneParticlePreset
  seasonLabel: string
  thumbUrl: string
}

export const DEFAULT_THEME_PACK: ConcreteThemePackId = 'spring-jiangnan'

export const SPRING_JIANGNAN_ASSETS: ThemePackAssets = {
  businessUrl: jiangnanBusinessUrl,
  frostUrl: jiangnanFrostUrl,
  masksUrl: jiangnanMasksUrl,
  sceneUrl: jiangnanSceneUrl,
}

export const THEME_PACKS: Readonly<Record<ConcreteThemePackId, ThemePackMeta>> = {
  'spring-jiangnan': {
    category: 'season',
    glOptions: {
      foliageAmp: 1.0,
      glowAmp: 0.0,
      mistAmp: 1.0,
      mistColor: [0.91, 0.94, 0.91],
      waterAmp: 1.0,
    },
    hasGreeter: true,
    id: 'spring-jiangnan',
    label: '烟雨江南',
    location: '江南水乡',
    particlePreset: 'rain',
    seasonLabel: '春',
    thumbUrl: springThumbUrl,
  },
  'summer-westlake': {
    category: 'season',
    glOptions: {
      foliageAmp: 0.95,
      glowAmp: 0.0,
      mistAmp: 0.85,
      mistColor: [0.9, 0.95, 0.94],
      waterAmp: 0.9,
    },
    hasGreeter: false,
    id: 'summer-westlake',
    label: '曲院风荷',
    location: '杭州西湖',
    particlePreset: 'firefly',
    seasonLabel: '夏',
    thumbUrl: summerThumbUrl,
  },
  'autumn-forbidden': {
    category: 'season',
    glOptions: {
      foliageAmp: 1.05,
      glowAmp: 0.0,
      mistAmp: 0.78,
      mistColor: [0.95, 0.93, 0.89],
      waterAmp: 0.82,
    },
    hasGreeter: false,
    id: 'autumn-forbidden',
    label: '紫禁秋杏',
    location: '北京故宫角楼',
    particlePreset: 'leaves',
    seasonLabel: '秋',
    thumbUrl: autumnThumbUrl,
  },
  'winter-harbin': {
    category: 'season',
    glOptions: {
      foliageAmp: 0.55,
      glowAmp: 0.0,
      mistAmp: 1.05,
      mistColor: [0.92, 0.95, 0.97],
      waterAmp: 0.6,
    },
    hasGreeter: false,
    id: 'winter-harbin',
    label: '哈尔滨雾凇',
    location: '松花江雾凇长堤',
    particlePreset: 'snow',
    seasonLabel: '冬',
    thumbUrl: winterThumbUrl,
  },
  'holiday-spring-festival': {
    badge: '春节限定',
    category: 'holiday',
    glOptions: {
      foliageAmp: 0.85,
      glowAmp: 1.0,
      glowColor: [1.0, 0.72, 0.36],
      mistAmp: 0.75,
      mistColor: [0.96, 0.92, 0.89],
      waterAmp: 0.95,
    },
    hasGreeter: false,
    id: 'holiday-spring-festival',
    label: '秦淮灯宵',
    location: '南京秦淮河',
    particlePreset: 'lantern',
    seasonLabel: '春节',
    thumbUrl: springFestivalThumbUrl,
  },
  'holiday-mid-autumn': {
    badge: '中秋限定',
    category: 'holiday',
    glOptions: {
      foliageAmp: 0.75,
      glowAmp: 0.9,
      glowColor: [1.0, 0.92, 0.68],
      mistAmp: 0.95,
      mistColor: [0.92, 0.94, 0.97],
      waterAmp: 0.88,
    },
    hasGreeter: false,
    id: 'holiday-mid-autumn',
    label: '三潭印月',
    location: '杭州西湖',
    particlePreset: 'osmanthus',
    seasonLabel: '中秋',
    thumbUrl: midAutumnThumbUrl,
  },
}

export const SEASON_THEME_PACKS: ReadonlyArray<ThemePackMeta> = [
  THEME_PACKS['spring-jiangnan'],
  THEME_PACKS['summer-westlake'],
  THEME_PACKS['autumn-forbidden'],
  THEME_PACKS['winter-harbin'],
]

export const HOLIDAY_THEME_PACKS: ReadonlyArray<ThemePackMeta> = [
  THEME_PACKS['holiday-spring-festival'],
  THEME_PACKS['holiday-mid-autumn'],
]

export const ALL_CONCRETE_THEME_PACK_IDS: ReadonlyArray<ConcreteThemePackId> = [
  'spring-jiangnan',
  'summer-westlake',
  'autumn-forbidden',
  'winter-harbin',
  'holiday-spring-festival',
  'holiday-mid-autumn',
]

export const isConcreteThemePackId = (value: unknown): value is ConcreteThemePackId =>
  typeof value === 'string' && value in THEME_PACKS

export const isThemePackSelection = (value: unknown): value is ThemePackSelection =>
  value === 'auto-season' || isConcreteThemePackId(value)

export const getThemePackMeta = (packId: ConcreteThemePackId): ThemePackMeta =>
  THEME_PACKS[packId] ?? THEME_PACKS[DEFAULT_THEME_PACK]

const assetCache = new Map<ConcreteThemePackId, ThemePackAssets>([
  ['spring-jiangnan', SPRING_JIANGNAN_ASSETS],
])

const assetLoaders: Record<ConcreteThemePackId, () => Promise<ThemePackAssets>> = {
  'spring-jiangnan': async () => SPRING_JIANGNAN_ASSETS,
  'summer-westlake': async () => {
    const [scene, business, frost, masks] = await Promise.all([
      import('@/assets/themes/summer-westlake/scene.webp'),
      import('@/assets/themes/summer-westlake/scene-business.webp'),
      import('@/assets/themes/summer-westlake/scene-frost.webp'),
      import('@/assets/themes/summer-westlake/scene-masks.webp'),
    ])
    return {
      businessUrl: business.default,
      frostUrl: frost.default,
      masksUrl: masks.default,
      sceneUrl: scene.default,
    }
  },
  'autumn-forbidden': async () => {
    const [scene, business, frost, masks] = await Promise.all([
      import('@/assets/themes/autumn-forbidden/scene.webp'),
      import('@/assets/themes/autumn-forbidden/scene-business.webp'),
      import('@/assets/themes/autumn-forbidden/scene-frost.webp'),
      import('@/assets/themes/autumn-forbidden/scene-masks.webp'),
    ])
    return {
      businessUrl: business.default,
      frostUrl: frost.default,
      masksUrl: masks.default,
      sceneUrl: scene.default,
    }
  },
  'winter-harbin': async () => {
    const [scene, business, frost, masks] = await Promise.all([
      import('@/assets/themes/winter-harbin/scene.webp'),
      import('@/assets/themes/winter-harbin/scene-business.webp'),
      import('@/assets/themes/winter-harbin/scene-frost.webp'),
      import('@/assets/themes/winter-harbin/scene-masks.webp'),
    ])
    return {
      businessUrl: business.default,
      frostUrl: frost.default,
      masksUrl: masks.default,
      sceneUrl: scene.default,
    }
  },
  'holiday-spring-festival': async () => {
    const [scene, business, frost, masks] = await Promise.all([
      import('@/assets/themes/holiday-spring-festival/scene.webp'),
      import('@/assets/themes/holiday-spring-festival/scene-business.webp'),
      import('@/assets/themes/holiday-spring-festival/scene-frost.webp'),
      import('@/assets/themes/holiday-spring-festival/scene-masks.webp'),
    ])
    return {
      businessUrl: business.default,
      frostUrl: frost.default,
      masksUrl: masks.default,
      sceneUrl: scene.default,
    }
  },
  'holiday-mid-autumn': async () => {
    const [scene, business, frost, masks] = await Promise.all([
      import('@/assets/themes/holiday-mid-autumn/scene.webp'),
      import('@/assets/themes/holiday-mid-autumn/scene-business.webp'),
      import('@/assets/themes/holiday-mid-autumn/scene-frost.webp'),
      import('@/assets/themes/holiday-mid-autumn/scene-masks.webp'),
    ])
    return {
      businessUrl: business.default,
      frostUrl: frost.default,
      masksUrl: masks.default,
      sceneUrl: scene.default,
    }
  },
}

/** Synchronously returns cached assets for the pack, if already loaded. */
export const getCachedThemePackAssets = (
  packId: ConcreteThemePackId,
): ThemePackAssets | undefined => assetCache.get(packId)

/** Lazily loads the WebP scene assets for a theme pack and caches them in memory. */
export const loadThemePackAssets = async (
  packId: ConcreteThemePackId,
): Promise<ThemePackAssets> => {
  const cached = assetCache.get(packId)
  if (cached) return cached
  const loader = assetLoaders[packId] ?? assetLoaders[DEFAULT_THEME_PACK]
  const loaded = await loader()
  assetCache.set(packId, loaded)
  return loaded
}
