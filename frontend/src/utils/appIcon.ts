import { Call } from '@wailsio/runtime'

export type AppIconMode = 'light' | 'dark' | 'auto'
export type EffectiveAppIcon = 'light' | 'dark'

export const APP_ICON_OPTIONS: ReadonlyArray<{
  label: string
  value: AppIconMode
}> = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'auto' },
]

export const isAppIconMode = (value: unknown): value is AppIconMode =>
  value === 'light' || value === 'dark' || value === 'auto'

export const getAppIconSrc = (appearance: EffectiveAppIcon): string =>
  appearance === 'dark' ? '/zhusuan-dark.png' : '/zhusuan.png'

export const resolveEffectiveAppIcon = (mode: AppIconMode): EffectiveAppIcon => {
  if (mode !== 'auto') return mode
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const serviceName = 'github.com/primordialweave/zhusuan/internal/desktop.AppIconManager'

const isDesktopRuntime = (): boolean => {
  if (typeof window === 'undefined') return false
  const runtime = window as Window & {
    _wails?: { environment?: { OS?: string } }
    __WAILS__?: { environment?: { OS?: string } }
  }
  const os = runtime._wails?.environment?.OS ?? runtime.__WAILS__?.environment?.OS
  return ['darwin', 'windows', 'linux'].includes(os ?? '')
}

interface NativeIconRequest {
  appearance: EffectiveAppIcon
}

let appliedNativeAppearance: EffectiveAppIcon | null = null
let desiredNativeAppearance: EffectiveAppIcon | null = null
let nativeIconRequest: NativeIconRequest | null = null

export const syncFavicon = (appearance: EffectiveAppIcon): void => {
  if (typeof document === 'undefined') return
  const href = getAppIconSrc(appearance)
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (existing) {
    if (existing.getAttribute('href') !== href) {
      existing.setAttribute('href', href)
    }
    return
  }
  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = href
  document.head.appendChild(link)
}

const finishNativeIconRequest = (request: NativeIconRequest, succeeded: boolean): void => {
  if (nativeIconRequest !== request) return
  nativeIconRequest = null
  appliedNativeAppearance = succeeded ? request.appearance : null

  // A changed choice gets one attempt after this call. A failure of the current choice
  // waits for an explicit sync, so an unavailable service cannot cause a retry loop.
  if (desiredNativeAppearance !== request.appearance) flushNativeAppIcon()
}

function flushNativeAppIcon(): void {
  const appearance = desiredNativeAppearance
  if (nativeIconRequest || appearance === null || appearance === appliedNativeAppearance) return
  const request = { appearance }
  nativeIconRequest = request
  try {
    void Call.ByName(`${serviceName}.SetAppearance`, appearance).then(
      () => finishNativeIconRequest(request, true),
      () => finishNativeIconRequest(request, false),
    )
  } catch {
    finishNativeIconRequest(request, false)
  }
}

export const syncNativeAppIcon = (appearance: EffectiveAppIcon): void => {
  if (!isDesktopRuntime()) return
  desiredNativeAppearance = appearance
  flushNativeAppIcon()
}

export const resetNativeAppIconSync = (): void => {
  appliedNativeAppearance = null
  desiredNativeAppearance = null
  nativeIconRequest = null
}
