import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Events } from '@wailsio/runtime'
import { DESKTOP_EVENTS, desktopManager, type DesktopState } from '@/utils/desktopManager'
import { useDesktopStore } from './desktop'

vi.mock('@/utils/desktopManager', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/desktopManager')>()
  return {
    ...original,
    desktopManager: {
      ...original.desktopManager,
      isAvailable: () => true,
      getState: vi.fn(),
      updatePreferences: vi.fn(),
    },
  }
})

const state = (privacyMode: boolean): DesktopState => ({
  preferences: {
    autostart: false,
    startHidden: false,
    closeAction: 'ask',
    menuBarDisplay: 'pending_count',
    privacyMode,
    hideDockWhenMinimized: false,
    rememberWindowBounds: true,
    trayClickAction: 'toggle_window',
    reminderEnabled: false,
    reminderTime: '09:30',
    toggleWindowShortcut: '',
    quickReceiptShortcut: '',
    privacyModeShortcut: '',
    autoBackupEnabled: false,
    autoBackupRetention: 7,
  },
  autostart: { enabled: false, supported: true, requiresApproval: false, strategy: '' },
  capabilities: {
    platform: 'darwin',
    autostartSupported: true,
    traySupported: true,
    menuBarLabelSupported: true,
    hideDockSupported: true,
    trayClickActionSupported: false,
    notificationsSupported: true,
    globalShortcutsSupported: true,
    autoBackupSupported: true,
  },
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('desktop state ordering', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useDesktopStore.setState({
      state: null,
      loading: false,
      saving: false,
      closePromptRevision: 0,
      closePrompt: { open: false, platform: '', traySupported: true },
    })
    document.documentElement.removeAttribute('data-privacy-mode')
    delete document.documentElement.dataset.nativeWindowVisibility
    useDesktopStore.setState({ windowHidden: false, closePromptRevision: 0 })
  })

  it('restores a cold hidden launch from the existing native state request', async () => {
    vi.mocked(desktopManager.getState).mockResolvedValueOnce({
      ...state(false),
      windowHidden: true,
    })
    await useDesktopStore.getState().refreshState()
    expect(useDesktopStore.getState().windowHidden).toBe(true)
    expect(document.documentElement.dataset.nativeWindowVisibility).toBe('hidden')
  })

  it('restores a pending close prompt on bootstrap and dismisses it when the window is hidden', async () => {
    vi.mocked(desktopManager.getState).mockResolvedValueOnce({
      ...state(false),
      closePromptOpen: true,
      closePromptRevision: 1,
    } as DesktopState)
    const dispose = useDesktopStore.getState().initialize()
    await vi.waitFor(() => expect(useDesktopStore.getState().closePrompt.open).toBe(true))
    expect(useDesktopStore.getState().closePrompt).toEqual({
      open: true,
      platform: 'darwin',
      traySupported: true,
    })
    const visibility = vi
      .mocked(Events.On)
      .mock.calls.find(([name]) => name === DESKTOP_EVENTS.windowVisibility)![1]
    const close = vi
      .mocked(Events.On)
      .mock.calls.find(([name]) => name === DESKTOP_EVENTS.closeRequested)![1]
    visibility({ data: [{ hidden: true, closePromptRevision: 2 }] } as never)
    close({ data: [{ platform: 'darwin', closePromptRevision: 1 }] } as never)
    expect(useDesktopStore.getState().closePrompt.open).toBe(false)
    dispose()
  })

  it('keeps a hide event newer than the initial state response while still initializing preferences', async () => {
    const pending = deferred<DesktopState>()
    vi.mocked(desktopManager.getState).mockReturnValueOnce(pending.promise)
    const dispose = useDesktopStore.getState().initialize()
    const visibility = vi
      .mocked(Events.On)
      .mock.calls.find(([name]) => name === DESKTOP_EVENTS.windowVisibility)![1]
    visibility({ data: [{ hidden: true }] } as never)
    pending.resolve({ ...state(false), windowHidden: false } as DesktopState)
    await pending.promise
    await Promise.resolve()
    expect(useDesktopStore.getState().state).not.toBeNull()
    expect(useDesktopStore.getState().windowHidden).toBe(true)
    expect(document.documentElement.dataset.nativeWindowVisibility).toBe('hidden')
    dispose()
  })

  it('does not let an old read disable privacy after an accepted preference write', async () => {
    const old = deferred<DesktopState>()
    vi.mocked(desktopManager.getState).mockReturnValueOnce(old.promise)
    vi.mocked(desktopManager.updatePreferences).mockResolvedValueOnce(state(true))
    const refresh = useDesktopStore.getState().refreshState()
    await useDesktopStore.getState().updatePreferences({ privacyMode: true })
    old.resolve(state(false))
    await refresh
    expect(useDesktopStore.getState().state?.preferences.privacyMode).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-privacy-mode', 'on')
  })

  it('keeps a native state event newer than an outstanding initial read', async () => {
    const old = deferred<DesktopState>()
    vi.mocked(desktopManager.getState).mockReturnValueOnce(old.promise)
    const dispose = useDesktopStore.getState().initialize()
    const changed = vi
      .mocked(Events.On)
      .mock.calls.find(([name]) => name === DESKTOP_EVENTS.stateChanged)![1]
    changed({ data: [state(true)] } as never)
    old.resolve(state(false))
    await old.promise
    await Promise.resolve()
    expect(useDesktopStore.getState().state?.preferences.privacyMode).toBe(true)
    dispose()
  })

  it('invalidates the pending initialization read when its subscription is disposed', async () => {
    const old = deferred<DesktopState>()
    vi.mocked(desktopManager.getState).mockReturnValueOnce(old.promise)
    const dispose = useDesktopStore.getState().initialize()
    dispose()
    old.resolve(state(true))
    await old.promise
    await Promise.resolve()
    expect(useDesktopStore.getState().state).toBeNull()
  })

  it('keeps saving true until all outstanding preference writes finish', async () => {
    const first = deferred<DesktopState>()
    const second = deferred<DesktopState>()
    vi.mocked(desktopManager.updatePreferences)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const one = useDesktopStore.getState().updatePreferences({ privacyMode: false })
    const two = useDesktopStore.getState().updatePreferences({ privacyMode: true })
    first.resolve(state(false))
    await one
    expect(useDesktopStore.getState().saving).toBe(true)
    second.resolve(state(true))
    await two
    expect(useDesktopStore.getState().saving).toBe(false)
    expect(useDesktopStore.getState().state?.preferences.privacyMode).toBe(true)
  })
})
