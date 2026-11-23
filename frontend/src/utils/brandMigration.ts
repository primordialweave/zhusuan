const marker = 'zhusuan.brandMigration.v1'
const endpoint = '/__zhusuan_migration__/preferences'
const preferenceKeys = [
  'theme',
  'lastUsername',
  'rememberPassword',
  'rememberMe',
  'workbenchSummaryScope',
  'zhusuan.appearance.v1',
  'zhusuan.themePack.v1',
] as const

export const applyLegacyPreferences = (values: Record<string, unknown>, storage: Storage) => {
  for (const key of preferenceKeys) {
    const legacyKey = key === 'zhusuan.appearance.v1' ? 'orange.appearance.v1' : key
    const value = values[key] ?? values[legacyKey] ?? storage.getItem(legacyKey)
    if (storage.getItem(key) === null && typeof value === 'string') storage.setItem(key, value)
  }
}

/** Runs before stores initialize; existing new values always take precedence. */
export const migrateBrandPreferences = async () => {
  try {
    if (localStorage.getItem(marker) === 'complete') return
    const runtime = window as Window & { _wails?: { environment?: { OS?: string } } }
    const desktop = ['darwin', 'windows', 'linux'].includes(runtime._wails?.environment?.OS ?? '')
    if (desktop) {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 3500)
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        applyLegacyPreferences((await response.json()) as Record<string, unknown>, localStorage)
      } finally {
        window.clearTimeout(timeout)
      }
    } else {
      applyLegacyPreferences({}, localStorage)
    }
    localStorage.setItem(marker, 'complete')
  } catch {
    // Retry on next launch; migration errors must not block the login page.
  }
}
