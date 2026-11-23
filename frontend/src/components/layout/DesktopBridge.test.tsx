import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Call, Events } from '@wailsio/runtime'
import DesktopBridge from './DesktopBridge'
import { useAuthStore } from '@/stores/auth'
import { useDesktopStore } from '@/stores/desktop'
import { DESKTOP_EVENTS, WINDOW_VISIBILITY_DOM_EVENT } from '@/utils/desktopManager'

function RouteSpy() {
  const location = useLocation()
  return <div data-testid="route-path">{location.pathname + location.search}</div>
}

describe('DesktopBridge', () => {
  const listeners = new Map<string, Array<(event: unknown) => void>>()

  beforeEach(() => {
    vi.clearAllMocks()
    listeners.clear()
    ;(window as Window & { _wails?: { environment?: { OS?: string } } })._wails = {
      environment: { OS: 'darwin' },
    }
    vi.mocked(Events.On).mockImplementation(((name: string, cb: (event: unknown) => void) => {
      const list = listeners.get(name) ?? []
      list.push(cb)
      listeners.set(name, list)
      return () => {
        const current = listeners.get(name) ?? []
        listeners.set(
          name,
          current.filter((item) => item !== cb),
        )
      }
    }) as never)
    vi.mocked(Call.ByName).mockImplementation(((name: string) => {
      if (name.endsWith('.GetState')) {
        return Promise.resolve({
          preferences: {
            autostart: false,
            startHidden: false,
            closeAction: 'ask',
            menuBarDisplay: 'pending_count',
            privacyMode: false,
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
      }
      return Promise.resolve(undefined)
    }) as never)

    useAuthStore.setState({
      token: 'tok',
      isLoggedIn: true,
      isAuthenticated: true,
      user: { id: 42, username: 'admin', name: 'Admin', role: 'admin', status: 1 } as never,
    })
    sessionStorage.setItem('token', 'tok')
    useDesktopStore.setState({
      state: null,
      loading: false,
      saving: false,
      windowHidden: false,
      closePrompt: { open: false, traySupported: true, platform: 'darwin' },
    })
  })

  const emitNative = (name: string, data: unknown) => {
    for (const cb of listeners.get(name) ?? []) {
      cb({ name, data })
    }
  }

  it('syncs session user, handles tray navigation, and dispatches background visibility events', async () => {
    const visibilitySpy = vi.fn()
    window.addEventListener(WINDOW_VISIBILITY_DOM_EVENT, visibilitySpy)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DesktopBridge />
        <Routes>
          <Route element={<RouteSpy />} path="*" />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.SetSessionUser',
        42,
        'tok',
      )
    })

    act(() => {
      emitNative(DESKTOP_EVENTS.navigate, { path: '/payment/create' })
    })
    expect(screen.getByTestId('route-path')).toHaveTextContent('/payment/create')

    act(() => {
      emitNative(DESKTOP_EVENTS.windowVisibility, { hidden: true })
    })
    expect(visibilitySpy).toHaveBeenCalledTimes(1)
    expect(
      (visibilitySpy.mock.calls[0]?.[0] as CustomEvent<{ hidden: boolean }>).detail.hidden,
    ).toBe(true)

    window.removeEventListener(WINDOW_VISIBILITY_DOM_EVENT, visibilitySpy)
  })

  it('opens close prompt on desktop:close-requested and forwards chosen action with remember flag', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DesktopBridge />
      </MemoryRouter>,
    )

    act(() => {
      emitNative(DESKTOP_EVENTS.closeRequested, { traySupported: true, platform: 'darwin' })
    })

    expect(screen.getByText('关闭珠算')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('记住我的选择'))
    fireEvent.click(screen.getByRole('button', { name: '隐藏到菜单栏' }))

    await waitFor(() => {
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.ResolveClosePrompt',
        'minimize_to_tray',
        true,
      )
    })
  })

  it('resyncs a renewed JWT for the same user and clears native credentials on logout', async () => {
    render(
      <MemoryRouter>
        <DesktopBridge />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.SetSessionUser',
        42,
        'tok',
      ),
    )
    act(() => {
      sessionStorage.setItem('token', 'renewed-token')
      useAuthStore.setState({ token: 'renewed-token' })
    })
    await waitFor(() =>
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.SetSessionUser',
        42,
        'renewed-token',
      ),
    )
    act(() => {
      sessionStorage.removeItem('token')
      useAuthStore.setState({ token: null, isLoggedIn: false, isAuthenticated: false, user: null })
    })
    await waitFor(() =>
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.SetSessionUser',
        0,
        '',
      ),
    )
  })
})
