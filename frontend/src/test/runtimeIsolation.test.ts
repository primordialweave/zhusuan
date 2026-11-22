import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('native runtime isolation in frontend tests', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('imports appearance without native drag pollers or mouse handlers', async () => {
    const interval = vi.spyOn(window, 'setInterval')
    const addListener = vi.spyOn(window, 'addEventListener')
    const pendingTimers = vi.getTimerCount()

    await import('@/stores/appearance')

    expect(vi.getTimerCount()).toBe(pendingTimers)
    expect(interval).not.toHaveBeenCalled()
    expect(
      addListener.mock.calls.filter(([type]) =>
        ['mousedown', 'mousemove', 'mouseup'].includes(type),
      ),
    ).toHaveLength(0)
    expect(Reflect.get(window, '_wails')?.setResizable).toBeUndefined()
  })

  it('retains generated binding conversion and cancellable promises through the mocked bridge', async () => {
    const { Call, CancellablePromise } = await import('@wailsio/runtime')
    const { CredentialStore } =
      await import('../../bindings/github.com/primordialweave/zhusuan/internal/desktop')
    const pendingTimers = vi.getTimerCount()

    const result = CredentialStore.Load('isolated-test-scope')

    expect(result).toBeInstanceOf(CancellablePromise)
    await expect(result).resolves.toBeNull()
    expect(Call.ByID).toHaveBeenCalledWith(expect.any(Number), 'isolated-test-scope')
    expect(vi.getTimerCount()).toBe(pendingTimers)
  })
})
