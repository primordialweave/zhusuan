import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Call } from '@wailsio/runtime'
import {
  getAppIconSrc,
  resetNativeAppIconSync,
  resolveEffectiveAppIcon,
  syncFavicon,
  syncNativeAppIcon,
} from './appIcon'

vi.mock('@wailsio/runtime', () => ({
  Call: {
    ByName: vi.fn().mockResolvedValue(undefined),
  },
}))

const deferred = () => {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const enableNativeRuntime = () => {
  Object.assign(window, { _wails: { environment: { OS: 'darwin' } } })
}

const settleNativeSync = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('appIcon utility', () => {
  beforeEach(() => {
    vi.mocked(Call.ByName).mockReset().mockResolvedValue(undefined)
    resetNativeAppIconSync()
    document.head.innerHTML = '<link rel="icon" href="/zhusuan.png">'
    delete (window as Window & { _wails?: unknown })._wails
    delete (window as Window & { __WAILS__?: unknown }).__WAILS__
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves explicit light/dark modes and follows system preference for auto', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList)

    expect(resolveEffectiveAppIcon('light')).toBe('light')
    expect(resolveEffectiveAppIcon('dark')).toBe('dark')
    expect(resolveEffectiveAppIcon('auto')).toBe('dark')
    expect(getAppIconSrc('light')).toBe('/zhusuan.png')
    expect(getAppIconSrc('dark')).toBe('/zhusuan-dark.png')
  })

  it('updates the document favicon href without duplicating link nodes', () => {
    syncFavicon('dark')
    const links = document.querySelectorAll('link[rel="icon"]')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/zhusuan-dark.png')

    syncFavicon('light')
    expect(links[0]).toHaveAttribute('href', '/zhusuan.png')
  })

  it('invokes Wails AppIconManager.SetAppearance once per successful change in desktop runtime', async () => {
    enableNativeRuntime()

    syncNativeAppIcon('dark')
    syncNativeAppIcon('dark')
    expect(Call.ByName).toHaveBeenCalledTimes(1)
    expect(Call.ByName).toHaveBeenCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.AppIconManager.SetAppearance',
      'dark',
    )

    await settleNativeSync()
    syncNativeAppIcon('light')
    expect(Call.ByName).toHaveBeenCalledTimes(2)
    expect(Call.ByName).toHaveBeenLastCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.AppIconManager.SetAppearance',
      'light',
    )
  })

  it('waits for an older native call before applying the latest choice while favicon changes immediately', async () => {
    enableNativeRuntime()
    const light = deferred()
    const dark = deferred()
    let nativeAppearance = ''
    vi.mocked(Call.ByName)
      .mockReturnValueOnce(
        light.promise.then(() => {
          nativeAppearance = 'light'
        }) as never,
      )
      .mockReturnValueOnce(
        dark.promise.then(() => {
          nativeAppearance = 'dark'
        }) as never,
      )

    syncNativeAppIcon('light')
    syncNativeAppIcon('dark')
    syncFavicon('dark')
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/zhusuan-dark.png')
    expect(Call.ByName).toHaveBeenCalledTimes(1)

    light.resolve()
    await settleNativeSync()
    expect(Call.ByName).toHaveBeenCalledTimes(2)
    expect(Call.ByName).toHaveBeenLastCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.AppIconManager.SetAppearance',
      'dark',
    )
    dark.resolve()
    await settleNativeSync()
    expect(nativeAppearance).toBe('dark')
    syncNativeAppIcon('dark')
    expect(Call.ByName).toHaveBeenCalledTimes(2)
  })

  it.each(['light', 'dark'] as const)(
    'coalesces rapid choices to the latest %s appearance without replaying obsolete choices',
    async (latest) => {
      enableNativeRuntime()
      const first = deferred()
      vi.mocked(Call.ByName).mockReturnValueOnce(first.promise as never)
      syncNativeAppIcon('light')
      for (const appearance of ['dark', 'light', 'dark', latest] as const) {
        syncNativeAppIcon(appearance)
      }
      expect(Call.ByName).toHaveBeenCalledTimes(1)

      first.resolve()
      await settleNativeSync()
      const expectedCalls = latest === 'light' ? 1 : 2
      expect(Call.ByName).toHaveBeenCalledTimes(expectedCalls)
      expect(Call.ByName).toHaveBeenLastCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.AppIconManager.SetAppearance',
        latest,
      )
      syncNativeAppIcon(latest)
      expect(Call.ByName).toHaveBeenCalledTimes(expectedCalls)
    },
  )

  it('allows retrying the same choice after failure without starting a tight retry loop', async () => {
    enableNativeRuntime()
    const failed = deferred()
    vi.mocked(Call.ByName).mockReturnValueOnce(failed.promise as never)
    syncNativeAppIcon('dark')
    failed.reject(new Error('native icon unavailable'))
    await settleNativeSync()
    expect(Call.ByName).toHaveBeenCalledTimes(1)

    syncNativeAppIcon('dark')
    expect(Call.ByName).toHaveBeenCalledTimes(2)
    await settleNativeSync()
    syncNativeAppIcon('dark')
    expect(Call.ByName).toHaveBeenCalledTimes(2)
  })

  it('applies a newer choice after the older call fails without repeatedly retrying either choice', async () => {
    enableNativeRuntime()
    const failed = deferred()
    vi.mocked(Call.ByName)
      .mockReturnValueOnce(failed.promise as never)
      .mockRejectedValueOnce(new Error('latest choice also unavailable'))
    syncNativeAppIcon('light')
    syncNativeAppIcon('dark')
    expect(Call.ByName).toHaveBeenCalledTimes(1)
    failed.reject(new Error('old choice unavailable'))
    await settleNativeSync()
    expect(Call.ByName).toHaveBeenCalledTimes(2)
    expect(Call.ByName).toHaveBeenLastCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.AppIconManager.SetAppearance',
      'dark',
    )
    await settleNativeSync()
    expect(Call.ByName).toHaveBeenCalledTimes(2)
  })

  it.each(['success', 'failure'])(
    'ignores an old request %s after sync reset while a new request for the same appearance is pending',
    async (outcome) => {
      enableNativeRuntime()
      const old = deferred()
      const current = deferred()
      vi.mocked(Call.ByName)
        .mockReturnValueOnce(old.promise as never)
        .mockReturnValueOnce(current.promise as never)
      syncNativeAppIcon('dark')
      resetNativeAppIconSync()
      syncNativeAppIcon('dark')
      if (outcome === 'success') old.resolve()
      else old.reject(new Error('old request failed'))
      await settleNativeSync()
      syncNativeAppIcon('dark')
      expect(Call.ByName).toHaveBeenCalledTimes(2)

      current.resolve()
      await settleNativeSync()
      syncNativeAppIcon('dark')
      expect(Call.ByName).toHaveBeenCalledTimes(2)
    },
  )

  it('skips native IPC outside desktop runtime', () => {
    syncNativeAppIcon('dark')
    expect(Call.ByName).not.toHaveBeenCalled()
  })
})
