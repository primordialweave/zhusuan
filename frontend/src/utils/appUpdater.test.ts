import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Call } from '@wailsio/runtime'
import api from '@/api'
import { appUpdater, isNewerVersion } from './appUpdater'

vi.mock('@wailsio/runtime', () => ({ Call: { ByName: vi.fn() } }))
vi.mock('@/api', () => ({ default: { get: vi.fn() } }))

describe('update version precedence', () => {
  it.each([
    ['v0.7.10', '0.7.2', true],
    ['0.8.0', '0.7.2', true],
    ['1.0.0', '0.99.99', true],
    ['0.7.1', '0.7.2', false],
    ['v0.7.2', '0.7.2', false],
    ['1.0.0+build.2', '1.0.0+build.1', false],
    ['1.0.0', '1.0.0-rc.2', true],
    ['1.0.0-rc.2', '1.0.0', false],
    ['1.0.0-rc.10', '1.0.0-rc.2', true],
    ['1.0.0-beta', '1.0.0-alpha', true],
    ['1.0.0-beta.1', '1.0.0-beta', true],
    ['1.0.0-beta', '1.0.0-beta.1', false],
    ['1.0.0-alpha.a', '1.0.0-alpha.9', true],
  ])('compares %s to %s', (latest, current, result) => {
    expect(isNewerVersion(latest, current)).toBe(result)
  })

  it.each(['main', '1.0', '01.0.0', '1.0.0-01'])('rejects invalid version %s', (version) => {
    expect(() => isNewerVersion(version, '0.7.2')).toThrow('版本信息无效')
  })
})

describe('appUpdater environment routing', () => {
  const originalRuntime = Object.getOwnPropertyDescriptor(window, '_wails')
  const originalCompatRuntime = Object.getOwnPropertyDescriptor(window, '__WAILS__')

  beforeEach(() => {
    vi.clearAllMocks()
    Reflect.deleteProperty(window, '_wails')
    Reflect.deleteProperty(window, '__WAILS__')
  })

  afterEach(() => {
    if (originalRuntime) Object.defineProperty(window, '_wails', originalRuntime)
    else Reflect.deleteProperty(window, '_wails')
    if (originalCompatRuntime) Object.defineProperty(window, '__WAILS__', originalCompatRuntime)
    else Reflect.deleteProperty(window, '__WAILS__')
  })

  it('uses native installed-version information and never suggests a downgrade', async () => {
    Object.defineProperty(window, '_wails', {
      configurable: true,
      value: { environment: { OS: 'windows' } },
    })
    vi.mocked(Call.ByName).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '0.9.0',
      available: true,
      supported: true,
      reason: '',
      releaseURL: 'https://github.com/primordialweave/zhusuan/releases/tag/v0.9.0',
      releaseNotes: '',
    })

    expect(await appUpdater.checkForUpdates('0.7.2')).toMatchObject({
      available: false,
      currentVersion: '1.0.0',
    })
    expect(Call.ByName).toHaveBeenCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.AppUpdater.CheckForUpdates',
    )
    expect(api.get).not.toHaveBeenCalled()
  })

  it('keeps an ordinary browser preview on the release-page flow', async () => {
    Object.defineProperty(window, '_wails', { configurable: true, value: { environment: {} } })
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          tag_name: 'v0.8.0',
          html_url: 'https://github.com/primordialweave/zhusuan/releases/tag/v0.8.0',
        },
      },
    })

    expect(await appUpdater.checkForUpdates('0.7.2')).toMatchObject({
      available: true,
      supported: false,
      currentVersion: '0.7.2',
      latestVersion: 'v0.8.0',
    })
    expect(Call.ByName).not.toHaveBeenCalled()
    expect(api.get).toHaveBeenCalledWith('/system/updates/check')
  })

  it('routes update, progress and cancellation to the native service', async () => {
    vi.mocked(Call.ByName).mockResolvedValue(undefined)
    await appUpdater.startUpdate()
    await appUpdater.status()
    await appUpdater.cancelUpdate()
    expect(vi.mocked(Call.ByName).mock.calls.map(([method]) => method)).toEqual([
      'github.com/primordialweave/zhusuan/internal/desktop.AppUpdater.StartUpdate',
      'github.com/primordialweave/zhusuan/internal/desktop.AppUpdater.Status',
      'github.com/primordialweave/zhusuan/internal/desktop.AppUpdater.CancelUpdate',
    ])
  })
})
