import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WindowTitleBar from './WindowTitleBar'

const runtime = vi.hoisted(() => ({
  state: { maximised: false, fullscreen: false },
  listeners: new Map<string, () => void>(),
  unsubscribe: [] as ReturnType<typeof vi.fn>[],
  events: {
    WindowMaximise: 'common:WindowMaximise',
    WindowUnMaximise: 'common:WindowUnMaximise',
    WindowRestore: 'common:WindowRestore',
    WindowFullscreen: 'common:WindowFullscreen',
    WindowUnFullscreen: 'common:WindowUnFullscreen',
  },
  on: vi.fn(),
  minimise: vi.fn(),
  toggleMaximise: vi.fn(),
  toggleFullscreen: vi.fn(),
  unFullscreen: vi.fn(),
  close: vi.fn(),
  isMaximised: vi.fn(),
  isFullscreen: vi.fn(),
}))

vi.mock('@wailsio/runtime', () => ({
  Events: { Types: { Common: runtime.events }, On: runtime.on },
  Window: {
    Minimise: runtime.minimise,
    ToggleMaximise: runtime.toggleMaximise,
    ToggleFullscreen: runtime.toggleFullscreen,
    UnFullscreen: runtime.unFullscreen,
    Close: runtime.close,
    IsMaximised: runtime.isMaximised,
    IsFullscreen: runtime.isFullscreen,
  },
}))

const originalWails = Object.getOwnPropertyDescriptor(window, '_wails')

function setPlatform(OS?: string) {
  Object.defineProperty(window, '_wails', {
    configurable: true,
    writable: true,
    value: OS ? { environment: { OS } } : undefined,
  })
}

async function renderWindows() {
  setPlatform('windows')
  const result = render(<WindowTitleBar />)
  await act(async () => {})
  return result
}

async function emitNativeEvent(name: string) {
  const listener = runtime.listeners.get(name)
  expect(listener).toBeTypeOf('function')
  await act(async () => listener?.())
}

describe('WindowTitleBar', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    runtime.state.maximised = false
    runtime.state.fullscreen = false
    runtime.listeners.clear()
    runtime.unsubscribe.length = 0
    runtime.isMaximised.mockImplementation(async () => runtime.state.maximised)
    runtime.isFullscreen.mockImplementation(async () => runtime.state.fullscreen)
    runtime.minimise.mockResolvedValue(undefined)
    runtime.close.mockResolvedValue(undefined)
    runtime.toggleMaximise.mockImplementation(async () => {
      runtime.state.maximised = !runtime.state.maximised
    })
    runtime.toggleFullscreen.mockImplementation(async () => {
      runtime.state.fullscreen = !runtime.state.fullscreen
    })
    runtime.unFullscreen.mockImplementation(async () => {
      runtime.state.fullscreen = false
    })
    runtime.on.mockImplementation((name: string, listener: () => void) => {
      runtime.listeners.set(name, listener)
      const off = vi.fn(() => runtime.listeners.delete(name))
      runtime.unsubscribe.push(off)
      return off
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (originalWails) Object.defineProperty(window, '_wails', originalWails)
    else Reflect.deleteProperty(window, '_wails')
  })

  it.each([undefined, 'darwin', 'linux'])('leaves %s without Windows controls', (platform) => {
    setPlatform(platform)
    const { container } = render(<WindowTitleBar />)

    expect(container).toBeEmptyDOMElement()
    expect(runtime.on).not.toHaveBeenCalled()
    expect(runtime.isFullscreen).not.toHaveBeenCalled()
    expect(document.documentElement).not.toHaveAttribute('data-desktop-platform')
  })

  it('exposes accessible native window actions and refreshes their visible state', async () => {
    const user = userEvent.setup()
    await renderWindows()

    expect(screen.getByRole('group', { name: '窗口控制' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-desktop-platform', 'windows')
    await user.click(screen.getByRole('button', { name: '最小化' }))
    expect(runtime.minimise).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '最大化' }))
    expect(runtime.toggleMaximise).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '还原' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '全屏' }))
    expect(runtime.toggleFullscreen).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '退出全屏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '还原' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '关闭窗口' }))
    expect(runtime.close).toHaveBeenCalledOnce()
  })

  it('reads initial native fullscreen and maximised state', async () => {
    runtime.state.maximised = true
    runtime.state.fullscreen = true
    await renderWindows()

    expect(screen.getByRole('button', { name: '退出全屏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '还原' })).toBeDisabled()
  })

  it('follows native maximise, restore and fullscreen changes', async () => {
    await renderWindows()

    runtime.state.maximised = true
    await emitNativeEvent(runtime.events.WindowMaximise)
    expect(screen.getByRole('button', { name: '还原' })).toBeEnabled()
    runtime.state.maximised = false
    await emitNativeEvent(runtime.events.WindowRestore)
    expect(screen.getByRole('button', { name: '最大化' })).toBeEnabled()
    runtime.state.fullscreen = true
    await emitNativeEvent(runtime.events.WindowFullscreen)
    expect(screen.getByRole('button', { name: '退出全屏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最大化' })).toBeDisabled()
    runtime.state.fullscreen = false
    await emitNativeEvent(runtime.events.WindowUnFullscreen)
    expect(screen.getByRole('button', { name: '全屏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最大化' })).toBeEnabled()
  })

  it('uses F11 to toggle fullscreen and Escape to leave it', async () => {
    await renderWindows()
    const enter = new KeyboardEvent('keydown', { key: 'F11', bubbles: true, cancelable: true })
    fireEvent(document, enter)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '退出全屏' })).toBeInTheDocument(),
    )
    expect(enter.defaultPrevented).toBe(true)
    expect(runtime.toggleFullscreen).toHaveBeenCalledOnce()

    const leave = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    fireEvent(document, leave)
    await waitFor(() => expect(screen.getByRole('button', { name: '全屏' })).toBeInTheDocument())
    expect(leave.defaultPrevented).toBe(true)
    expect(runtime.unFullscreen).toHaveBeenCalledOnce()

    const ordinaryEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    fireEvent(document, ordinaryEscape)
    expect(ordinaryEscape.defaultPrevented).toBe(false)
    expect(runtime.unFullscreen).toHaveBeenCalledOnce()
  })

  it('respects handled keys and ignores auto-repeat', async () => {
    await renderWindows()
    const handled = new KeyboardEvent('keydown', { key: 'F11', cancelable: true })
    handled.preventDefault()
    fireEvent(document, handled)
    fireEvent.keyDown(document, { key: 'F11', repeat: true })

    expect(runtime.toggleFullscreen).not.toHaveBeenCalled()
    runtime.state.fullscreen = true
    await emitNativeEvent(runtime.events.WindowFullscreen)
    const handledEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    handledEscape.preventDefault()
    fireEvent(document, handledEscape)
    fireEvent.keyDown(document, { key: 'Escape', repeat: true })
    expect(runtime.unFullscreen).not.toHaveBeenCalled()
  })

  it('queries native state on mount and events without polling while idle', async () => {
    vi.useFakeTimers()
    await renderWindows()
    expect(runtime.isMaximised).toHaveBeenCalledOnce()
    expect(runtime.isFullscreen).toHaveBeenCalledOnce()

    await act(async () => vi.advanceTimersByTime(60_000))

    expect(runtime.isMaximised).toHaveBeenCalledOnce()
    expect(runtime.isFullscreen).toHaveBeenCalledOnce()
    await emitNativeEvent(runtime.events.WindowRestore)
    expect(runtime.isMaximised).toHaveBeenCalledTimes(2)
    expect(runtime.isFullscreen).toHaveBeenCalledTimes(2)
  })

  it('removes native and keyboard listeners when controls unmount', async () => {
    const added = vi.spyOn(document, 'addEventListener')
    const removed = vi.spyOn(document, 'removeEventListener')
    const { unmount } = await renderWindows()
    const keyboard = added.mock.calls.find(([name]) => name === 'keydown')?.[1]
    expect(keyboard).toBeTypeOf('function')
    expect(runtime.listeners.size).toBe(5)

    unmount()

    expect(runtime.listeners.size).toBe(0)
    runtime.unsubscribe.forEach((off) => expect(off).toHaveBeenCalledOnce())
    expect(removed).toHaveBeenCalledWith('keydown', keyboard)
    expect(document.documentElement).not.toHaveAttribute('data-desktop-platform')
    fireEvent.keyDown(document, { key: 'F11' })
    expect(runtime.toggleFullscreen).not.toHaveBeenCalled()
  })
})
