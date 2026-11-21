import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useLocation, useNavigate } from 'react-router-dom'
import { notificationApi, type Notification } from '@/api/notification'
import { useAuthStore } from '@/stores/auth'
import { fireEvent, render, screen, waitFor } from '@/test/render'
import NotificationEntry from './NotificationEntry'

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const unreadNotification: Notification = {
  content: '项目进度发生变化',
  create_time: '2026-07-11T10:00:00Z',
  id: 7,
  is_global: 1,
  is_read: false,
  sender_id: 1,
  title: '项目已更新',
  type: 2,
}

vi.mock('@/api/notification', () => ({
  notificationApi: {
    getUnreadCount: vi.fn(),
    list: vi.fn(),
    markAsRead: vi.fn(),
  },
}))

const respondWith = (count: number, list: Notification[]) => {
  vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({
    data: { data: { count } },
  } as never)
  vi.mocked(notificationApi.list).mockResolvedValue({ data: { data: { list } } } as never)
}

const signIn = () =>
  useAuthStore.setState({
    isAuthenticated: true,
    isLoggedIn: true,
    token: 'test-token',
    user: { id: 1, username: 'tester', name: '测试用户' } as never,
  })

const signOut = () =>
  useAuthStore.setState({ isAuthenticated: false, isLoggedIn: false, token: null, user: null })

const findTrigger = () => screen.findByRole('button', { name: /查看通知/ })

describe('NotificationEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    respondWith(0, [])
    vi.mocked(notificationApi.markAsRead).mockResolvedValue({ data: { data: null } } as never)
    signOut()
  })

  afterEach(() => {
    signOut()
  })

  test('uses a dock skeleton until both initial notification requests settle', async () => {
    const countRequest = createDeferred<unknown>()
    const listRequest = createDeferred<unknown>()
    vi.mocked(notificationApi.getUnreadCount).mockReturnValueOnce(countRequest.promise as never)
    vi.mocked(notificationApi.list).mockReturnValueOnce(listRequest.promise as never)
    signIn()
    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    expect(screen.getByRole('status', { name: '正在加载最近通知' })).toBeInTheDocument()
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledOnce())
    await act(async () => countRequest.resolve({ data: { data: { count: 1 } } }))
    expect(screen.getByRole('status', { name: '正在加载最近通知' })).toBeInTheDocument()
    await act(async () => listRequest.resolve({ data: { data: { list: [unreadNotification] } } }))

    expect(await findTrigger()).toHaveAccessibleName('查看通知，1 条未读')
    expect(screen.queryByRole('status', { name: '正在加载最近通知' })).not.toBeInTheDocument()
  })

  test('does not poll or render a trigger while signed out', async () => {
    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    await act(async () => {
      await Promise.resolve()
    })
    expect(notificationApi.getUnreadCount).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /查看通知/ })).not.toBeInTheDocument()
  })

  test('renders no trigger while nothing is unread', async () => {
    signIn()
    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: /查看通知/ })).not.toBeInTheDocument()
  })

  test('announces the unread count on its trigger', async () => {
    respondWith(3, [unreadNotification])
    signIn()
    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    const trigger = await findTrigger()
    expect(trigger).toHaveAccessibleName('查看通知，3 条未读')
    expect(trigger).toHaveClass('ods-button', 'ods-icon-button')
    expect(trigger.querySelector('[data-slot="mark"]')).not.toHaveAttribute('data-invisible')
  })

  test('opens recent notifications in a portalled popover, not an ARIA menu', async () => {
    const user = userEvent.setup()
    respondWith(1, [unreadNotification])
    signIn()
    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    const trigger = await findTrigger()
    await user.click(trigger)

    const popover = screen.getByRole('region', { name: '最近通知' })
    expect(trigger).toHaveAttribute('aria-controls', popover.id)
    expect(popover.parentElement).toBe(document.body)
    expect(popover).toHaveAttribute('data-padding', 'none')
    expect(screen.getByRole('button', { name: /项目已更新/ })).toHaveAttribute(
      'data-auto-height',
      'true',
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  test('closes the popover on Escape and restores trigger focus', async () => {
    const user = userEvent.setup()
    respondWith(1, [unreadNotification])
    signIn()
    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    const trigger = await findTrigger()
    await user.click(trigger)
    expect(screen.getByRole('region', { name: '最近通知' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('region', { name: '最近通知' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  test('dismisses the popover on an outside pointer press', async () => {
    const user = userEvent.setup()
    respondWith(1, [unreadNotification])
    signIn()
    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    await user.click(await findTrigger())
    expect(screen.getByRole('region', { name: '最近通知' })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('region', { name: '最近通知' })).not.toBeInTheDocument()
  })

  test('closes the popover when the current location changes', async () => {
    function LocationDriver() {
      const navigate = useNavigate()
      return (
        <button onClick={() => navigate('/dashboard?period=month')} type="button">
          改变位置
        </button>
      )
    }

    const user = userEvent.setup()
    respondWith(1, [unreadNotification])
    signIn()
    render(
      <>
        <NotificationEntry />
        <LocationDriver />
      </>,
      { initialEntries: ['/dashboard'] },
    )

    await user.click(await findTrigger())
    expect(screen.getByRole('region', { name: '最近通知' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '改变位置' }))

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '最近通知' })).not.toBeInTheDocument(),
    )
  })

  test('leads to the full notification list in settings', async () => {
    function LocationProbe() {
      const location = useLocation()
      return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
    }

    const user = userEvent.setup()
    respondWith(1, [unreadNotification])
    signIn()
    render(
      <>
        <NotificationEntry />
        <LocationProbe />
      </>,
      { initialEntries: ['/dashboard'] },
    )

    await user.click(await findTrigger())
    await user.click(screen.getByRole('button', { name: '查看全部' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/settings?tab=notification')
    expect(screen.queryByRole('region', { name: '最近通知' })).not.toBeInTheDocument()
  })

  test('opens the detail, marks it read, then retires the trigger once focus moves on', async () => {
    const user = userEvent.setup()
    respondWith(1, [unreadNotification])
    signIn()
    render(
      <>
        <NotificationEntry />
        <button type="button">别处</button>
      </>,
      { initialEntries: ['/dashboard'] },
    )

    const trigger = await findTrigger()
    await user.click(trigger)
    await user.click(await screen.findByText('项目已更新'))

    const dialog = screen.getByRole('dialog', { name: '通知详情' })
    expect(dialog).toHaveTextContent('项目进度发生变化')
    expect(notificationApi.markAsRead).toHaveBeenCalledWith(7)
    await waitFor(() =>
      expect(trigger.querySelector('[data-slot="mark"]')).toHaveAttribute('data-invisible', 'true'),
    )

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '通知详情' })).not.toBeInTheDocument()
    // Nothing is unread any more, but the trigger stays to take focus back.
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAccessibleName('查看通知')

    await user.click(screen.getByRole('button', { name: '别处' }))
    expect(screen.queryByRole('button', { name: /查看通知/ })).not.toBeInTheDocument()
  })

  test('does not let an older refresh restore unread state after marking as read', async () => {
    const user = userEvent.setup()
    const staleCount = createDeferred<Awaited<ReturnType<typeof notificationApi.getUnreadCount>>>()
    const staleList = createDeferred<Awaited<ReturnType<typeof notificationApi.list>>>()
    const markAsRead = createDeferred<Awaited<ReturnType<typeof notificationApi.markAsRead>>>()

    vi.mocked(notificationApi.getUnreadCount)
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { count: 1 } } } as never)
      .mockReturnValueOnce(staleCount.promise)
    vi.mocked(notificationApi.list)
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { list: [unreadNotification] } } } as never)
      .mockReturnValueOnce(staleList.promise)
    vi.mocked(notificationApi.markAsRead).mockReset().mockReturnValueOnce(markAsRead.promise)
    signIn()

    render(<NotificationEntry />, { initialEntries: ['/dashboard'] })

    const trigger = await findTrigger()
    const unreadMark = trigger.querySelector('[data-slot="mark"]')
    await waitFor(() => expect(unreadMark).not.toHaveAttribute('data-invisible'))

    await user.click(trigger)
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(2))
    await user.click(screen.getByText('项目已更新'))

    await act(async () => {
      markAsRead.resolve({ data: { data: null } } as never)
      await markAsRead.promise
    })
    await waitFor(() => expect(unreadMark).toHaveAttribute('data-invisible', 'true'))

    await act(async () => {
      staleCount.resolve({ data: { data: { count: 1 } } } as never)
      staleList.resolve({ data: { data: { list: [unreadNotification] } } } as never)
      await Promise.all([staleCount.promise, staleList.promise])
    })

    expect(unreadMark).toHaveAttribute('data-invisible', 'true')
  })
})
