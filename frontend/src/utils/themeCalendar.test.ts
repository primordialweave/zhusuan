import { describe, expect, it } from 'vitest'
import {
  getActiveHolidayWindow,
  resolveEffectiveThemePack,
  resolveSeasonThemePack,
} from './themeCalendar'

describe('themeCalendar', () => {
  it('maps solar-term boundaries to the four seasonal Chinese landmark packs', () => {
    expect(resolveSeasonThemePack(new Date(2026, 1, 3))).toBe('winter-harbin')
    expect(resolveSeasonThemePack(new Date(2026, 1, 4))).toBe('spring-jiangnan')
    expect(resolveSeasonThemePack(new Date(2026, 4, 4))).toBe('spring-jiangnan')
    expect(resolveSeasonThemePack(new Date(2026, 4, 5))).toBe('summer-westlake')
    expect(resolveSeasonThemePack(new Date(2026, 7, 6))).toBe('summer-westlake')
    expect(resolveSeasonThemePack(new Date(2026, 7, 7))).toBe('autumn-forbidden')
    expect(resolveSeasonThemePack(new Date(2026, 10, 6))).toBe('autumn-forbidden')
    expect(resolveSeasonThemePack(new Date(2026, 10, 7))).toBe('winter-harbin')
    expect(resolveSeasonThemePack(new Date(2026, 0, 15))).toBe('winter-harbin')
  })

  it('detects Spring Festival and Mid-Autumn holiday windows offline', () => {
    expect(getActiveHolidayWindow(new Date(2026, 1, 16))?.packId).toBe('holiday-spring-festival')
    expect(getActiveHolidayWindow(new Date(2026, 2, 3))?.packId).toBe('holiday-spring-festival')
    expect(getActiveHolidayWindow(new Date(2026, 2, 4))).toBeNull()

    expect(getActiveHolidayWindow(new Date(2026, 8, 25))?.packId).toBe('holiday-mid-autumn')
    expect(getActiveHolidayWindow(new Date(2026, 8, 28))).toBeNull()
  })

  it('activates holiday theme automatically unless disabled or dismissed for that holiday instance', () => {
    const springFestivalDay = new Date(2026, 1, 17)

    const active = resolveEffectiveThemePack({
      autoHolidayTheme: true,
      now: springFestivalDay,
      selection: 'spring-jiangnan',
    })
    expect(active.packId).toBe('holiday-spring-festival')
    expect(active.triggeredByHoliday).toBe(true)

    const dismissed = resolveEffectiveThemePack({
      autoHolidayTheme: true,
      dismissedHolidayId: '2026:holiday-spring-festival',
      now: springFestivalDay,
      selection: 'autumn-forbidden',
    })
    expect(dismissed.packId).toBe('autumn-forbidden')
    expect(dismissed.triggeredByHoliday).toBe(false)

    // Next year's Spring Festival should activate again even if 2026 was dismissed.
    const nextYear = resolveEffectiveThemePack({
      autoHolidayTheme: true,
      dismissedHolidayId: '2026:holiday-spring-festival',
      now: new Date(2027, 1, 6),
      selection: 'autumn-forbidden',
    })
    expect(nextYear.packId).toBe('holiday-spring-festival')
    expect(nextYear.triggeredByHoliday).toBe(true)

    const disabled = resolveEffectiveThemePack({
      autoHolidayTheme: false,
      now: springFestivalDay,
      selection: 'auto-season',
    })
    expect(disabled.packId).toBe('spring-jiangnan')
    expect(disabled.triggeredByHoliday).toBe(false)
  })
})
