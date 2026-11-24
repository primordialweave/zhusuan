import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Call, Events } from '@wailsio/runtime'
import MenuBarPopoverView from './MenuBarPopoverView'
import { APPEARANCE_STORAGE_KEY } from '@/stores/appearance'
import { THEME_PACK_STORAGE_KEY } from '@/stores/theme'
import { DAY_CHANGED_DOM_EVENT, DESKTOP_EVENTS, type MenuBarSnapshot } from '@/utils/desktopManager'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const makeSnapshot = (overrides?: Partial<MenuBarSnapshot>): MenuBarSnapshot => ({
  loggedIn: true,
  scope: 'month',
  periodReceived: 128400,
  contractTotal: 200000,
  contractReceived: 150000,
  totalPending: 50000,
  overdueAmount: 12000,
  overdueCount: 2,
  upcomingCount: 1,
  privacyMode: false,
  trend: [
    { label: '11-01', amount: 24000 },
    { label: '11-10', amount: 64400 },
    { label: '11-20', amount: 40000 },
  ],
  items: [
    {
      paymentId: 10,
      projectId: 7,
      projectName: '翡翠台账改造',
      stage: 'progress',
      amount: 12000,
      planDate: '2026-11-18',
      overdue: true,
    },
  ],
  ...overrides,
})

describe('MenuBarPopoverView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Call.ByName).mockReset()
    ;(window as Window & { _wails?: { environment?: { OS?: string } } })._wails = {
      environment: { OS: 'darwin' },
    }
  })

  it('renders guest prompt without leaking financial figures when logged out', async () => {
    vi.mocked(Call.ByName).mockResolvedValueOnce(
      makeSnapshot({ loggedIn: false, periodReceived: 0, trend: [], items: [] }) as never,
    )

    render(<MenuBarPopoverView />)

    await waitFor(() => {
      expect(screen.getByText('登录珠算查看实时收款与趋势')).toBeInTheDocument()
    })
    expect(screen.queryByText('实际收款趋势')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开珠算登录' }))
    expect(Call.ByName).toHaveBeenCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.OpenRouteFromMenuBar',
      '/login',
    )
  })

  it('renders hero metrics, 75% jade ring, SVG trend chart, scope switch, and quick actions', async () => {
    vi.mocked(Call.ByName)
      .mockResolvedValueOnce(makeSnapshot() as never)
      .mockResolvedValueOnce(makeSnapshot({ scope: 'year', periodReceived: 860000 }) as never)

    render(<MenuBarPopoverView />)

    await waitFor(() => {
      expect(screen.getByText('¥128,400')).toBeInTheDocument()
    })
    expect(screen.getByAltText('珠算')).toHaveAttribute('src', '/zhusuan-wordmark.png')
    expect(screen.getByLabelText('合同回款率 75%')).toBeInTheDocument()
    expect(screen.getByLabelText('实际收款趋势')).toBeInTheDocument()
    expect(screen.getByText('逾期 2 笔')).toBeInTheDocument()
    expect(screen.getByText('翡翠台账改造')).toBeInTheDocument()

    // Switch scope to year.
    fireEvent.click(screen.getByRole('radio', { name: '本年' }))
    await waitFor(() => {
      expect(screen.getByText('¥860,000')).toBeInTheDocument()
    })

    // Click quick receipt action.
    fireEvent.click(screen.getByRole('button', { name: '记一笔收款' }))
    expect(Call.ByName).toHaveBeenCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.OpenRouteFromMenuBar',
      '/payment/create',
    )

    // Press Escape to dismiss popover.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(Call.ByName).toHaveBeenCalledWith(
      'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.HideMenuBarPopover',
    )
  })

  it('masks all displayed amounts in privacy mode', async () => {
    vi.mocked(Call.ByName).mockResolvedValueOnce(makeSnapshot({ privacyMode: true }) as never)

    render(<MenuBarPopoverView />)

    await waitFor(() => {
      expect(screen.getAllByText(/¥\*\*\*\*/).length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.queryByText('¥128,400')).not.toBeInTheDocument()
  })

  it('does not let an older period request replace a newer period or label old amounts as current', async () => {
    const old = deferred<MenuBarSnapshot>()
    const latest = deferred<MenuBarSnapshot>()
    vi.mocked(Call.ByName)
      .mockResolvedValueOnce(makeSnapshot() as never)
      .mockReturnValueOnce(old.promise as never)
      .mockReturnValueOnce(latest.promise as never)
    render(<MenuBarPopoverView />)
    await screen.findByText('¥128,400')
    const refresh = vi
      .mocked(Events.On)
      .mock.calls.find(([name]) => name === DESKTOP_EVENTS.menuBarUpdated)![1]
    act(() => {
      refresh({ data: [] } as never)
    })
    fireEvent.click(screen.getByRole('radio', { name: '本年' }))
    expect(screen.queryByText('¥128,400')).not.toBeInTheDocument()
    await waitFor(() => expect(Call.ByName).toHaveBeenCalledTimes(3))
    await act(async () => {
      latest.resolve(makeSnapshot({ scope: 'year', periodReceived: 860000 }))
    })
    expect(screen.getByText('¥860,000')).toBeInTheDocument()
    await act(async () => {
      old.resolve(makeSnapshot())
    })
    expect(screen.getByText('¥860,000')).toBeInTheDocument()
    expect(screen.queryByText('¥128,400')).not.toBeInTheDocument()
  })

  it('does not restore signed-out amounts when an older refresh completes after a logout update', async () => {
    const old = deferred<MenuBarSnapshot>()
    const latest = deferred<MenuBarSnapshot>()
    vi.mocked(Call.ByName)
      .mockResolvedValueOnce(makeSnapshot() as never)
      .mockReturnValueOnce(old.promise as never)
      .mockReturnValueOnce(latest.promise as never)
    render(<MenuBarPopoverView />)
    await screen.findByText('¥128,400')
    const refresh = vi
      .mocked(Events.On)
      .mock.calls.find(([name]) => name === DESKTOP_EVENTS.menuBarUpdated)![1]
    act(() => {
      refresh({ data: [] } as never)
      refresh({ data: [] } as never)
    })
    await act(async () => {
      latest.resolve(makeSnapshot({ loggedIn: false, periodReceived: 0, trend: [], items: [] }))
    })
    expect(screen.getByText('登录珠算查看实时收款与趋势')).toBeInTheDocument()
    await act(async () => {
      old.resolve(makeSnapshot())
    })
    expect(screen.getByText('登录珠算查看实时收款与趋势')).toBeInTheDocument()
    expect(screen.queryByText('¥128,400')).not.toBeInTheDocument()
  })

  it('syncs light/dark theme and scenic theme pack across windows via storage events', async () => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem(
      THEME_PACK_STORAGE_KEY,
      JSON.stringify({
        autoHolidayTheme: false,
        dismissedHolidayId: null,
        themePack: 'spring-jiangnan',
      }),
    )
    vi.mocked(Call.ByName).mockResolvedValueOnce(makeSnapshot() as never)

    render(<MenuBarPopoverView />)

    await waitFor(() => {
      expect(screen.getByText('¥128,400')).toBeInTheDocument()
    })

    act(() => {
      localStorage.setItem('theme', 'dark')
      localStorage.setItem(
        THEME_PACK_STORAGE_KEY,
        JSON.stringify({
          autoHolidayTheme: false,
          dismissedHolidayId: null,
          themePack: 'autumn-forbidden',
        }),
      )
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_PACK_STORAGE_KEY }))
    })

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme-pack')).toBe('autumn-forbidden')
    })

    act(() => {
      localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({
          appIcon: 'auto',
          liquidGlass: false,
          reduceMotion: true,
          sceneMotion: false,
        }),
      )
      window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_STORAGE_KEY }))
    })

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-glass')).toBe('solid')
      expect(document.documentElement.getAttribute('data-motion')).toBe('reduced')
    })

    const dayChangedHandler = vi
      .mocked(Events.On)
      .mock.calls.find(([name]) => name === DESKTOP_EVENTS.dayChanged)?.[1]
    expect(dayChangedHandler).toBeDefined()
    const onDomDayChanged = vi.fn()
    window.addEventListener(DAY_CHANGED_DOM_EVENT, onDomDayChanged)
    vi.mocked(Call.ByName).mockResolvedValueOnce(makeSnapshot() as never)
    act(() => {
      dayChangedHandler?.({ data: [{ date: '2026-11-25' }] } as never)
    })
    expect(onDomDayChanged).toHaveBeenCalledOnce()
    window.removeEventListener(DAY_CHANGED_DOM_EVENT, onDomDayChanged)
  })
})
