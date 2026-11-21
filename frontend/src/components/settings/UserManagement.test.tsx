import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi, type User } from '@/api/auth'
import { fireEvent, render, screen, waitFor, within } from '@/test/render'
import UserManagement from './UserManagement'

vi.mock('@/api/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/auth')>()
  return {
    ...original,
    authApi: {
      ...original.authApi,
      createUser: vi.fn(),
      getUsers: vi.fn(),
      resetPassword: vi.fn(),
    },
  }
})

const managedUser: User = {
  avatar: '',
  department: '研发部',
  email: 'orange@example.com',
  id: 7,
  name: '橙子',
  phone: '13800000000',
  position: '工程师',
  role: 'user',
  status: 1,
  username: 'orange',
}

const usersResponse = {
  data: {
    data: {
      list: [managedUser],
      total: 1,
    },
  },
}

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, reject, resolve }
}

describe('UserManagement search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authApi.getUsers)
      .mockReset()
      .mockResolvedValue(usersResponse as never)
  })

  it('shows a table skeleton until the first response arrives instead of an empty user list', async () => {
    const request = deferred<typeof usersResponse>()
    vi.mocked(authApi.getUsers).mockReturnValueOnce(request.promise as never)
    render(<UserManagement />)

    expect(screen.getByRole('status', { name: '正在加载用户列表' })).toBeInTheDocument()
    expect(screen.queryByText('暂无用户')).not.toBeInTheDocument()
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledOnce())
    await act(async () => request.resolve(usersResponse))

    expect(await screen.findByText(managedUser.email)).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载用户列表' })).not.toBeInTheDocument()
  })

  it('clears the applied server-side keyword when SearchField is cleared', async () => {
    const user = userEvent.setup()
    render(<UserManagement />)

    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(1))
    const search = screen.getByRole('searchbox', { name: '搜索用户' })
    await user.type(search, 'orange{Enter}')
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(2))
    expect(authApi.getUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'orange', page: 1 }),
    )

    await user.click(screen.getByRole('button', { name: '清空搜索' }))

    expect(search).toHaveValue('')
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(3))
    expect(authApi.getUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: undefined, page: 1 }),
    )
  })

  it('hides old-query rows and counts immediately, ends a failed query, and retries that query', async () => {
    const failedRequest = deferred<typeof usersResponse>()
    const retryRequest = deferred<typeof usersResponse>()
    vi.mocked(authApi.getUsers)
      .mockResolvedValueOnce(usersResponse as never)
      .mockReturnValueOnce(failedRequest.promise as never)
      .mockReturnValueOnce(retryRequest.promise as never)
    const user = userEvent.setup()
    render(<UserManagement />)
    expect(await screen.findByText(managedUser.email)).toBeInTheDocument()

    const search = screen.getByRole('searchbox', { name: '搜索用户' })
    fireEvent.change(search, { target: { value: 'latest' } })
    fireEvent.keyUp(search, { key: 'Enter' })
    expect(screen.getByRole('status', { name: '正在加载用户列表' })).toBeInTheDocument()
    expect(screen.queryByText(managedUser.email)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑用户' })).not.toBeInTheDocument()
    expect(screen.queryByText(/显示 .* 条，共/)).not.toBeInTheDocument()
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(2))

    await act(async () => {
      failedRequest.reject(new Error('offline'))
      await failedRequest.promise.catch(() => undefined)
    })
    expect(await screen.findByText('用户列表加载失败')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载用户列表' })).not.toBeInTheDocument()
    expect(screen.queryByText(managedUser.email)).not.toBeInTheDocument()
    expect(screen.queryByText(/显示 .* 条，共/)).not.toBeInTheDocument()
    expect(authApi.getUsers).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: '重试用户列表' }))
    expect(screen.getByRole('status', { name: '正在加载用户列表' })).toBeInTheDocument()
    expect(screen.queryByText('用户列表加载失败')).not.toBeInTheDocument()
    expect(authApi.getUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'latest', page: 1 }),
    )
    await act(async () => {
      retryRequest.resolve({
        data: {
          data: {
            list: [{ ...managedUser, name: '最新用户', email: 'latest@example.com' }],
            total: 1,
          },
        },
      })
      await retryRequest.promise
    })
    expect(await screen.findByText('latest@example.com')).toBeInTheDocument()
    expect(screen.queryByText(managedUser.email)).not.toBeInTheDocument()
    expect(authApi.getUsers).toHaveBeenCalledTimes(3)
  })

  it('shows a retryable error instead of an empty list when the initial request fails', async () => {
    vi.mocked(authApi.getUsers).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<UserManagement />)

    expect(await screen.findByText('用户列表加载失败')).toBeInTheDocument()
    expect(screen.queryByText('暂无用户')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载用户列表' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重试用户列表' }))
    expect(await screen.findByText(managedUser.email)).toBeInTheDocument()
    expect(authApi.getUsers).toHaveBeenCalledTimes(2)
  })

  it('preserves known users and pagination when a same-query mutation refresh fails', async () => {
    const request = deferred<typeof usersResponse>()
    vi.mocked(authApi.getUsers)
      .mockResolvedValueOnce({ data: { data: { list: [managedUser], total: 10 } } } as never)
      .mockReturnValueOnce(request.promise as never)
    vi.mocked(authApi.createUser).mockResolvedValue(undefined as never)
    const user = userEvent.setup()
    render(<UserManagement />)
    expect(await screen.findByText(managedUser.email)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /新增用户/ }))
    const dialog = await screen.findByRole('dialog', { name: '新增用户' })
    await user.type(within(dialog).getByLabelText(/用户名/), 'new-user')
    await user.type(within(dialog).getByLabelText(/姓名/), '新用户')
    await user.type(within(dialog).getByLabelText(/初始密码/), 'secret123')
    await user.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(2))

    expect(screen.getByText(managedUser.email)).toBeInTheDocument()
    expect(screen.getByText('显示 1-5 条，共 10 条')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '用户列表' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('status', { name: '正在加载用户列表' })).not.toBeInTheDocument()
    await act(async () => {
      request.reject(new Error('offline'))
      await request.promise.catch(() => undefined)
    })
    expect(await screen.findByText('用户列表加载失败')).toBeInTheDocument()
    expect(screen.getByText(managedUser.email)).toBeInTheDocument()
    expect(screen.getByText('显示 1-5 条，共 10 条')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '用户列表' })).toHaveAttribute('aria-busy', 'false')
    expect(authApi.createUser).toHaveBeenCalledOnce()
    expect(authApi.getUsers).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale user-list response after the search changes', async () => {
    const firstRequest = deferred<typeof usersResponse>()
    const secondRequest = deferred<typeof usersResponse>()
    vi.mocked(authApi.getUsers)
      .mockReset()
      .mockReturnValueOnce(firstRequest.promise as never)
      .mockReturnValueOnce(secondRequest.promise as never)
    const user = userEvent.setup()
    render(<UserManagement />)

    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(1))
    await user.type(screen.getByRole('searchbox', { name: '搜索用户' }), 'latest{Enter}')
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(2))

    const latestUser = { ...managedUser, id: 8, name: '最新用户', username: 'latest' }
    await act(async () => {
      secondRequest.resolve({
        data: { data: { list: [latestUser], total: 1 } },
      })
      await secondRequest.promise
    })
    expect(await screen.findByText('最新用户')).toBeInTheDocument()

    await act(async () => {
      firstRequest.resolve(usersResponse)
      await firstRequest.promise
    })
    expect(screen.getByText('最新用户')).toBeInTheDocument()
    expect(screen.queryByText('橙子')).not.toBeInTheDocument()
  })

  it('submits a user mutation only once while the first request is pending', async () => {
    const createRequest = deferred<unknown>()
    vi.mocked(authApi.createUser).mockReturnValue(createRequest.promise as never)
    const user = userEvent.setup()
    render(<UserManagement />)

    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: /新增用户/ }))
    const dialog = await screen.findByRole('dialog', { name: '新增用户' })
    await user.type(within(dialog).getByLabelText(/用户名/), 'new-user')
    await user.type(within(dialog).getByLabelText(/姓名/), '新用户')
    await user.type(within(dialog).getByLabelText(/初始密码/), 'secret123')

    const form = within(dialog).getByRole('button', { name: '保存' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(authApi.createUser).toHaveBeenCalledTimes(1)
    await act(async () => {
      createRequest.resolve(undefined)
      await createRequest.promise
    })
  })

  it('uses distinct row button hierarchy for edit, reset password, and delete actions', async () => {
    render(<UserManagement />)
    expect(await screen.findByText(managedUser.email)).toBeInTheDocument()

    const editButton = screen.getByRole('button', { name: '编辑用户' })
    const resetButton = screen.getByRole('button', { name: '重置用户密码' })
    const deleteButton = screen.getByRole('button', { name: '删除用户' })

    expect(editButton).toHaveAttribute('data-variant', 'tertiary')
    expect(resetButton).toHaveAttribute('data-variant', 'secondary')
    expect(deleteButton).toHaveAttribute('data-variant', 'tertiary')
    expect(deleteButton).toHaveAttribute('data-tone', 'danger')
  })
})
