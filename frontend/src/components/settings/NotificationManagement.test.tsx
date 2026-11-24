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
    vi.mocked(notificationApi.getUsers)
      .mockReset()
      .mockResolvedValue({ data: { data: [] } } as never)
    vi.mocked(notificationApi.create)
      .mockReset()
      .mockResolvedValue(undefined as never)
    vi.mocked(notificationApi.update)
      .mockReset()
      .mockResolvedValue(undefined as never)
  })

  it('refreshes the current page when a deletion completes after the user paginates', async () => {
    const user = userEvent.setup()
    const deletion = deferred<unknown>()
    vi.mocked(notificationApi.list).mockImplementation(
      (page) =>
        Promise.resolve(
          response([notification(page === 1 ? 1 : 6, page === 1 ? '第一页通知' : '当前页通知')]),
        ) as never,
    )
    vi.mocked(notificationApi.delete).mockReturnValueOnce(deletion.promise as never)
    render(<NotificationManagement isAdmin />)
    await screen.findByText('第一页通知')
    await user.click(screen.getByRole('button', { name: '删除通知' }))
    await user.click(
      within(screen.getByRole('alertdialog', { name: '确认删除' })).getByRole('button', {
        name: '删除通知',
      }),
    )
    await user.click(screen.getByRole('button', { name: '下一页' }))
    await screen.findByText('当前页通知')
    await act(async () => {
      deletion.resolve(undefined)
    })
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(3))
    expect(vi.mocked(notificationApi.list).mock.calls.map(([page]) => page)).toEqual([1, 2, 2])
    expect(screen.getByText('当前页通知')).toBeInTheDocument()
  })

  it('does not delete a notification from a confirmation that outlives the panel', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationApi.delete).mockReset()
    const { rerender } = render(<NotificationManagement isAdmin />)
    await screen.findByText('初始通知')
    await user.click(screen.getByRole('button', { name: '删除通知' }))
    const dialog = screen.getByRole('alertdialog', { name: '确认删除' })
    rerender(<div>已离开通知设置</div>)
    await user.click(within(dialog).getByRole('button', { name: '删除通知' }))
    expect(notificationApi.delete).not.toHaveBeenCalled()
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

  it('uses distinct row button hierarchy for view, edit, and delete actions', async () => {
    render(<NotificationManagement isAdmin />)
    expect(await screen.findByText('初始通知')).toBeInTheDocument()

    const viewButton = screen.getByRole('button', { name: '查看通知：初始通知' })
    const editButton = screen.getByRole('button', { name: '编辑通知' })
    const deleteButton = screen.getByRole('button', { name: '删除通知' })

    expect(viewButton).toHaveAttribute('data-variant', 'tertiary')
    expect(editButton).toHaveAttribute('data-variant', 'secondary')
    expect(deleteButton).toHaveAttribute('data-variant', 'tertiary')
    expect(deleteButton).toHaveAttribute('data-tone', 'danger')
  })

  const targetUsers = [
    { id: 11, name: '管理员', username: 'admin' },
    { id: 12, name: '徐', username: 'xu' },
  ]
  const targetLabel = (id: number) =>
    id === 0 ? '全员通知' : id === 11 ? '管理员 (admin)' : '徐 (xu)'

  async function openEdit(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText('对象通知')
    await user.click(screen.getByRole('button', { name: '编辑通知' }))
    return screen.findByRole('dialog', { name: '编辑通知' })
  }

  const recipientNotification = (id: number) => ({
    ...notification(22, '对象通知'),
    is_global: id === 0 ? 1 : 0,
    target_user_id: id,
    type: 2,
  })

  it('recalls a targeted recipient and preserves it when saving only content', async () => {
    const stored = recipientNotification(11)
    vi.mocked(notificationApi.list).mockResolvedValue(response([stored]) as never)
    vi.mocked(notificationApi.getUsers).mockResolvedValue({ data: { data: targetUsers } } as never)
    const user = userEvent.setup()
    render(<NotificationManagement isAdmin />)
    const dialog = await openEdit(user)

    expect(within(dialog).getByRole('button', { name: '发送对象' })).toHaveTextContent(
      '管理员 (admin)',
    )
    await user.clear(within(dialog).getByLabelText(/通知内容/))
    await user.type(within(dialog).getByLabelText(/通知内容/), '新的内容')
    await user.click(within(dialog).getByRole('button', { name: '更新' }))
    await waitFor(() =>
      expect(notificationApi.update).toHaveBeenCalledWith(22, {
        content: '新的内容',
        target_user_id: 11,
        title: '对象通知',
        type: 'activity',
      }),
    )
  })

  it.each([
    [11, 12],
    [11, 0],
    [0, 12],
  ])(
    'submits recipient %i to %i and recalls the freshly fetched recipient on reopening',
    async (from, to) => {
      let stored = recipientNotification(from)
      vi.mocked(notificationApi.list).mockImplementation(async () => response([stored]) as never)
      vi.mocked(notificationApi.getUsers).mockResolvedValue({
        data: { data: targetUsers },
      } as never)
      vi.mocked(notificationApi.update).mockImplementation(async (_id, request) => {
        stored = {
          ...stored,
          target_user_id: request.target_user_id ?? 0,
          is_global: to === 0 ? 1 : 0,
        }
        return { data: { data: stored } } as never
      })
      const user = userEvent.setup()
      render(<NotificationManagement isAdmin />)
      const dialog = await openEdit(user)
      expect(within(dialog).getByRole('button', { name: '发送对象' })).toHaveTextContent(
        targetLabel(from),
      )
      await user.click(within(dialog).getByRole('button', { name: '发送对象' }))
      await user.click(screen.getByRole('option', { name: targetLabel(to) }))
      await user.click(within(dialog).getByRole('button', { name: '更新' }))
      await waitFor(() => expect(notificationApi.list).toHaveBeenCalledTimes(2))
      expect(notificationApi.update).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ target_user_id: to, type: 'activity' }),
      )
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '编辑通知' })).toBeNull())
      const reopened = await openEdit(user)
      expect(within(reopened).getByRole('button', { name: '发送对象' })).toHaveTextContent(
        targetLabel(to),
      )
    },
  )

  it('keeps the chosen recipient in the edit draft after failure and sends it again on retry', async () => {
    const stored = recipientNotification(11)
    vi.mocked(notificationApi.list).mockResolvedValue(response([stored]) as never)
    vi.mocked(notificationApi.getUsers).mockResolvedValue({ data: { data: targetUsers } } as never)
    vi.mocked(notificationApi.update).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<NotificationManagement isAdmin />)
    const dialog = await openEdit(user)
    await user.click(within(dialog).getByRole('button', { name: '发送对象' }))
    await user.click(screen.getByRole('option', { name: '徐 (xu)' }))
    await user.click(within(dialog).getByRole('button', { name: '更新' }))
    await waitFor(() => expect(notificationApi.update).toHaveBeenCalledOnce())
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '发送对象' })).toHaveTextContent('徐 (xu)')
    await user.click(within(dialog).getByRole('button', { name: '更新' }))
    await waitFor(() => expect(notificationApi.update).toHaveBeenCalledTimes(2))
    for (const [, request] of vi.mocked(notificationApi.update).mock.calls) {
      expect(request.target_user_id).toBe(12)
    }
  })

  it.each([undefined, 0])(
    'does not broadcast an unknown private recipient (%s)',
    async (target) => {
      vi.mocked(notificationApi.list).mockResolvedValue(
        response([
          { ...notification(22, '对象通知'), is_global: 0, target_user_id: target },
        ]) as never,
      )
      vi.mocked(notificationApi.getUsers).mockResolvedValue({
        data: { data: targetUsers },
      } as never)
      const user = userEvent.setup()
      render(<NotificationManagement isAdmin />)
      const dialog = await openEdit(user)
      expect(within(dialog).getByRole('button', { name: '发送对象' })).not.toHaveTextContent(
        '全员通知',
      )
      await user.click(within(dialog).getByRole('button', { name: '更新' }))
      expect(notificationApi.update).not.toHaveBeenCalled()
      expect(dialog).toBeInTheDocument()
    },
  )

  it('keeps recipient editing and user lookup unavailable to non-administrators', async () => {
    render(<NotificationManagement />)
    await screen.findByText('初始通知')
    expect(screen.queryByRole('button', { name: '编辑通知' })).toBeNull()
    expect(screen.queryByRole('button', { name: /发送通知/ })).toBeNull()
    expect(notificationApi.getUsers).not.toHaveBeenCalled()
  })

  it('preserves the existing private type when changing only its recipient', async () => {
    const stored = { ...recipientNotification(11), type: 3 }
    vi.mocked(notificationApi.list).mockResolvedValue(response([stored]) as never)
    vi.mocked(notificationApi.getUsers).mockResolvedValue({ data: { data: targetUsers } } as never)
    const user = userEvent.setup()
    render(<NotificationManagement isAdmin />)
    const dialog = await openEdit(user)
    expect(within(dialog).getByRole('button', { name: '通知类型' })).toHaveTextContent('私信')
    await user.click(within(dialog).getByRole('button', { name: '发送对象' }))
    await user.click(screen.getByRole('option', { name: '徐 (xu)' }))
    await user.click(within(dialog).getByRole('button', { name: '更新' }))
    await waitFor(() =>
      expect(notificationApi.update).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ target_user_id: 12, type: 'private' }),
      ),
    )
  })

  it('retains a known recipient ID when its name cannot be loaded', async () => {
    vi.mocked(notificationApi.list).mockResolvedValue(
      response([recipientNotification(11)]) as never,
    )
    vi.mocked(notificationApi.getUsers).mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<NotificationManagement isAdmin />)
    const dialog = await openEdit(user)
    expect(within(dialog).getByRole('button', { name: '发送对象' })).toHaveTextContent('用户 #11')
    await user.click(within(dialog).getByRole('button', { name: '更新' }))
    await waitFor(() =>
      expect(notificationApi.update).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ target_user_id: 11 }),
      ),
    )
  })

  it('shows the recipient name on targeted notifications for administrators in list and detail views', async () => {
    const targeted = { ...recipientNotification(12), is_read: true }
    vi.mocked(notificationApi.list).mockResolvedValue(response([targeted]) as never)
    vi.mocked(notificationApi.getUsers).mockResolvedValue({ data: { data: targetUsers } } as never)
    const user = userEvent.setup()
    render(<NotificationManagement isAdmin />)

    expect(await screen.findByText('活动 · 徐')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看通知：对象通知' }))
    const detail = await screen.findByRole('dialog', { name: '通知详情' })
    expect(within(detail).getByText('定向通知 · 徐')).toBeInTheDocument()
    expect(notificationApi.markAsRead).not.toHaveBeenCalled()
  })
})
