/**
 * @file utils/themeCalendar.ts
 * @description Pure offline calendar resolver for seasonal and Chinese holiday themes.
 * Uses a compact 2025–2035 solar-date table for lunar holidays (zero network requests).
 */

export type SeasonThemePackId =
  | 'spring-jiangnan'
  | 'summer-westlake'
  | 'autumn-forbidden'
  | 'winter-harbin'

export type HolidayThemePackId = 'holiday-spring-festival' | 'holiday-mid-autumn'

export type ConcreteThemePackId = SeasonThemePackId | HolidayThemePackId

export type ThemePackSelection = ConcreteThemePackId | 'auto-season'

export interface HolidayWindow {
  /** Inclusive start date in YYYY-MM-DD (local calendar date). */
  start: string
  /** Inclusive end date in YYYY-MM-DD (local calendar date). */
  end: string
  packId: HolidayThemePackId
  /** Stable annual instance key (e.g. "2026:holiday-spring-festival") so manual dismissal lasts only for this holiday. */
  instanceId: string
}

/**
 * Compact 2025–2035 lunar holiday windows mapped to local solar dates:
 * - Spring Festival (春节 · 秦淮灯宵): Lunar New Year's Eve (除夕) through Lantern Festival (正月十五)
 * - Mid-Autumn Festival (中秋 · 三潭印月): Lunar 8/13 through 8/17 (5-day moonlit window)
 */
const HOLIDAY_WINDOWS: ReadonlyArray<HolidayWindow> = [
  // 2025
  { instanceId: '2025:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2025-01-28', end: '2025-02-12' },
  { instanceId: '2025:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2025-10-04', end: '2025-10-08' },
  // 2026
  { instanceId: '2026:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2026-02-16', end: '2026-03-03' },
  { instanceId: '2026:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2026-09-23', end: '2026-09-27' },
  // 2027
  { instanceId: '2027:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2027-02-05', end: '2027-02-20' },
  { instanceId: '2027:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2027-09-13', end: '2027-09-17' },
  // 2028
  { instanceId: '2028:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2028-01-25', end: '2028-02-09' },
  { instanceId: '2028:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2028-10-01', end: '2028-10-05' },
  // 2029
  { instanceId: '2029:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2029-02-12', end: '2029-02-27' },
  { instanceId: '2029:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2029-09-20', end: '2029-09-24' },
  // 2030
  { instanceId: '2030:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2030-02-02', end: '2030-02-17' },
  { instanceId: '2030:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2030-09-10', end: '2030-09-14' },
  // 2031
  { instanceId: '2031:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2031-01-22', end: '2031-02-06' },
  { instanceId: '2031:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2031-09-29', end: '2031-10-03' },
  // 2032
  { instanceId: '2032:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2032-02-10', end: '2032-02-25' },
  { instanceId: '2032:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2032-09-17', end: '2032-09-21' },
  // 2033
  { instanceId: '2033:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2033-01-30', end: '2033-02-14' },
  { instanceId: '2033:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2033-09-06', end: '2033-09-10' },
  // 2034
  { instanceId: '2034:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2034-02-18', end: '2034-03-05' },
  { instanceId: '2034:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2034-09-25', end: '2034-09-29' },
  // 2035
  { instanceId: '2035:holiday-spring-festival', packId: 'holiday-spring-festival', start: '2035-02-07', end: '2035-02-22' },
  { instanceId: '2035:holiday-mid-autumn', packId: 'holiday-mid-autumn', start: '2035-09-14', end: '2035-09-18' },
]

const formatLocalDate = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Resolves the Chinese solar-term season for a local calendar date:
 * - Spring (立春 ~ 立夏前): Feb 4 – May 4
 * - Summer (立夏 ~ 立秋前): May 5 – Aug 6
 * - Autumn (立秋 ~ 立冬前): Aug 7 – Nov 6
 * - Winter (立冬 ~ 立春前): Nov 7 – Feb 3
 */
export function resolveSeasonThemePack(date: Date = new Date()): SeasonThemePackId {
  const md = (date.getMonth() + 1) * 100 + date.getDate()
  if (md >= 204 && md <= 504) return 'spring-jiangnan'
  if (md >= 505 && md <= 806) return 'summer-westlake'
  if (md >= 807 && md <= 1106) return 'autumn-forbidden'
  return 'winter-harbin'
}

/** Returns the active holiday window if `date` falls inside a supported Chinese holiday. */
export function getActiveHolidayWindow(date: Date = new Date()): HolidayWindow | null {
  const iso = formatLocalDate(date)
  return HOLIDAY_WINDOWS.find((window) => iso >= window.start && iso <= window.end) ?? null
}

export interface ResolveThemePackInput {
  selection: ThemePackSelection
  autoHolidayTheme: boolean
  dismissedHolidayId?: string | null
  now?: Date
}

export interface ResolvedThemePackResult {
  packId: ConcreteThemePackId
  activeHoliday: HolidayWindow | null
  triggeredByHoliday: boolean
}

/**
 * Resolves the concrete theme pack to apply:
 * 1. If `autoHolidayTheme` is on and today matches an undismissed holiday window, use it.
 * 2. Otherwise if `selection === 'auto-season'`, use today's solar-term season pack.
 * 3. Otherwise use the user's explicit pack selection.
 */
export function resolveEffectiveThemePack({
  autoHolidayTheme,
  dismissedHolidayId = null,
  now = new Date(),
  selection,
}: ResolveThemePackInput): ResolvedThemePackResult {
  const activeHoliday = getActiveHolidayWindow(now)
  if (
    autoHolidayTheme &&
    activeHoliday !== null &&
    dismissedHolidayId !== activeHoliday.instanceId
  ) {
    return {
      activeHoliday,
      packId: activeHoliday.packId,
      triggeredByHoliday: true,
    }
  }

  return {
    activeHoliday,
    packId: selection === 'auto-season' ? resolveSeasonThemePack(now) : selection,
    triggeredByHoliday: false,
  }
}
