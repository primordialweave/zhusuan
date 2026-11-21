import { act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notificationApi, type Notification } from '@/api/notification'
import { fireEvent, render, screen, waitFor, within } from '@/test/render'
import NotificationManagement from './NotificationManagement'

vi.mock('@/api/notification', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/notification')>()
  return {
    ...original,
    notificationApi: {
      ...original.notificationApi,
      create: vi.fn(),
      delete: vi.fn(),
      getUsers: vi.fn(),
      list: vi.fn(),
      markAsRead: vi.fn(),
      update: vi.fn(),
    },
  }
})

const notification = (id: number, title: string): Notification => ({
  content: `${title}内容`,
  create_time: '2026-07-16T10:00:00Z',
  id,
  is_global: 1,
  is_read: false,
  sender_id: 1,
  title,
  type: 1,
})

const response = (list: Notification[]) => ({ data: { data: { list, total: 10 } } })

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, reject, resolve }
}

async function sendNotification(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /发送通知/ }))
  const dialog = await screen.findByRole('dialog', { name: '发送通知' })
  await user.type(within(dialog).getByLabelText(/通知标题/), '新通知')
  await user.type(within(dialog).getByLabelText(/通知内容/), '新通知内容')
  await user.click(within(dialog).getByRole('button', { name: '发送' }))
}

describe('NotificationManagement request integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notificationApi.list)
      .mockReset()
      .mockResolvedValue(response([notification(1, '初始通知')]) as never)
    vi.mocked(notificationApi.getUsers).mockResolvedValue({ data: { data: [] } } as never)
    vi.mocked(notificationApi.create).mockResolvedValue(undefined as never)
  })

  it('distinguishes an unknown notification list from a loaded empty list', async () => {
    const request = deferred<ReturnType<typeof response>>()
    vi.mocked(notificationApi.list).mockReturnValueOnce(request.promise as never)
    render(<NotificationManagement />)

    expect(screen.getByRole('status', { name: '正在加载通知列表' })).toBeInTheDocument()
    expect(screen.queryByText('暂无通知')).not.toBeInTheDocument()
    expect(screen.queryByText('全部已读')).not.toBeInTheDocument()
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledOnce())
    await act(async () => request.resolve(response([])))

    expect(await screen.findByText('暂无通知')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载通知列表' })).not.toBeInTheDocument()
  })

  it('does not let an older page response overwrite the latest page', async () => {
    const staleRequest = deferred<ReturnType<typeof response>>()
    const latestRequest = deferred<ReturnType<typeof response>>()
    vi.mocked(notificationApi.list)
      .mockResolvedValueOnce(response([notification(1, '初始通知')]) as never)
      .mockReturnValueOnce(staleRequest.promise as never)
      .mockReturnValueOnce(latestRequest.promise as never)
    const user = userEvent.setup()
    render(<NotificationManagement isAdmin />)

    expect(await screen.findByText('初始通知')).toBeInTheDocument()
    await sendNotification(user)
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(3))

    await act(async () => {
      latestRequest.resolve(response([notification(3, '最新通知')]))
      await latestRequest.promise
    })
    expect(await screen.findByText('最新通知')).toBeInTheDocument()

    await act(async () => {
      staleRequest.resolve(response([notification(2, '过期通知')]))
      await staleRequest.promise
    })
    expect(screen.getByText('最新通知')).toBeInTheDocument()
    expect(screen.queryByText('过期通知')).not.toBeInTheDocument()
  })

  it('hides old page content and counts immediately, ends a failed page, and retries it', async () => {
    const failedRequest = deferred<ReturnType<typeof response>>()
    const retryRequest = deferred<ReturnType<typeof response>>()
    vi.mocked(notificationApi.list)
      .mockResolvedValueOnce(response([notification(1, '初始通知')]) as never)
      .mockReturnValueOnce(failedRequest.promise as never)
      .mockReturnValueOnce(retryRequest.promise as never)
    const user = userEvent.setup()
    render(<NotificationManagement />)
    expect(await screen.findByText('初始通知')).toBeInTheDocument()
    expect(screen.getByText('1 条未读')).toBeInTheDocument()
    expect(screen.getByText('显示 1-5 条，共 10 条')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByRole('status', { name: '正在加载通知列表' })).toBeInTheDocument()
    expect(screen.queryByText('初始通知')).not.toBeInTheDocument()
    expect(screen.queryByText(/条未读/)).not.toBeInTheDocument()
    expect(screen.queryByText(/显示 .* 条，共/)).not.toBeInTheDocument()
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(2))
    await act(async () => {
      failedRequest.reject(new Error('offline'))
      await failedRequest.promise.catch(() => undefined)
    })
    expect(await screen.findByText('通知列表加载失败')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载通知列表' })).not.toBeInTheDocument()
    expect(screen.queryByText('初始通知')).not.toBeInTheDocument()
    expect(screen.queryByText('全部已读')).not.toBeInTheDocument()
    expect(screen.queryByText(/条未读/)).not.toBeInTheDocument()
    expect(screen.queryByText(/显示 .* 条，共/)).not.toBeInTheDocument()
    expect(notificationApi.list).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: '重试通知列表' }))
    expect(screen.getByRole('status', { name: '正在加载通知列表' })).toBeInTheDocument()
    expect(screen.queryByText('通知列表加载失败')).not.toBeInTheDocument()
    expect(notificationApi.list).toHaveBeenLastCalledWith(2, 5)
    await act(async () => {
      retryRequest.resolve(response([notification(2, '新页通知')]))
      await retryRequest.promise
    })
    expect(await screen.findByText('新页通知')).toBeInTheDocument()
    expect(screen.getByText('显示 6-10 条，共 10 条')).toBeInTheDocument()
    expect(screen.queryByText('初始通知')).not.toBeInTheDocument()
    expect(notificationApi.list).toHaveBeenCalledTimes(3)
  })

  it('shows an initial failure without claiming an empty or fully read list and supports retry', async () => {
    vi.mocked(notificationApi.list).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<NotificationManagement />)

    expect(await screen.findByText('通知列表加载失败')).toBeInTheDocument()
    expect(screen.queryByText('暂无通知')).not.toBeInTheDocument()
    expect(screen.queryByText('全部已读')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载通知列表' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重试通知列表' }))
    expect(await screen.findByText('初始通知')).toBeInTheDocument()
    expect(notificationApi.list).toHaveBeenCalledTimes(2)
  })

  it('preserves known notifications and counts when a same-page mutation refresh fails', async () => {
    const request = deferred<ReturnType<typeof response>>()
    vi.mocked(notificationApi.list)
      .mockResolvedValueOnce(response([notification(1, '初始通知')]) as never)
      .mockReturnValueOnce(request.promise as never)
    const user = userEvent.setup()
    const { container } = render(<NotificationManagement isAdmin />)
    expect(await screen.findByText('初始通知')).toBeInTheDocument()
    await sendNotification(user)
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(2))

    expect(screen.getByText('初始通知')).toBeInTheDocument()
    expect(screen.getByText('1 条未读')).toBeInTheDocument()
    expect(screen.getByText('显示 1-5 条，共 10 条')).toBeInTheDocument()
    expect(container.querySelector('.settings-list')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('status', { name: '正在加载通知列表' })).not.toBeInTheDocument()
    await act(async () => {
      request.reject(new Error('offline'))
      await request.promise.catch(() => undefined)
    })
    expect(await screen.findByText('通知列表加载失败')).toBeInTheDocument()
    expect(screen.getByText('初始通知')).toBeInTheDocument()
    expect(screen.getByText('1 条未读')).toBeInTheDocument()
    expect(screen.getByText('显示 1-5 条，共 10 条')).toBeInTheDocument()
    expect(container.querySelector('.settings-list')).toHaveAttribute('aria-busy', 'false')
    expect(notificationApi.create).toHaveBeenCalledOnce()
    expect(notificationApi.list).toHaveBeenCalledTimes(2)
  })
})
