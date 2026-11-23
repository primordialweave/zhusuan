import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi, type User } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
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
      updateUser: vi.fn(),
      getCurrentUser: vi.fn(),
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
    vi.mocked(authApi.updateUser).mockReset()
    vi.mocked(authApi.getCurrentUser).mockReset()
    useAuthStore.setState({
      token: 'managed-session',
      user: { ...managedUser, role: 'admin' },
      isLoggedIn: true,
      isAuthenticated: true,
      loading: false,
      error: null,
    })
    sessionStorage.setItem('token', 'managed-session')
    sessionStorage.setItem('user', JSON.stringify({ ...managedUser, role: 'admin' }))
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

  it('immediately uses the accepted self edit in the row, profile and stored session before list refresh completes', async () => {
    const self = { ...managedUser, role: 'admin' }
    const accepted = {
      ...self,
      name: '服务端接受的姓名',
      department: '新部门',
      phone: '13900000000',
    }
    const refresh = deferred<typeof usersResponse>()
    const oldProfile = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    vi.mocked(authApi.getCurrentUser).mockReturnValueOnce(oldProfile.promise)
    const profileRefresh = useAuthStore.getState().refreshUser()
    vi.mocked(authApi.getUsers)
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { list: [self], total: 1 } } } as never)
      .mockReturnValueOnce(refresh.promise as never)
    vi.mocked(authApi.updateUser).mockResolvedValue({ data: { data: accepted } } as never)
    const user = userEvent.setup()
    render(<UserManagement />)
    await user.click(await screen.findByRole('button', { name: '编辑用户' }))
    const dialog = await screen.findByRole('dialog', { name: '编辑用户' })
    fireEvent.change(within(dialog).getByLabelText(/姓名/), { target: { value: '提交的姓名' } })
    await user.click(within(dialog).getByRole('button', { name: '保存' }))

    await waitFor(() => expect(authApi.updateUser).toHaveBeenCalledOnce())
    expect(screen.getByText(accepted.name)).toBeInTheDocument()
    expect(useAuthStore.getState().user).toEqual(accepted)
    expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(accepted)
    expect(sessionStorage.getItem('token')).toBe('managed-session')
    await act(async () => refresh.resolve({ data: { data: { list: [accepted], total: 1 } } }))
    await act(async () => {
      oldProfile.resolve({ data: { data: self } } as never)
      await profileRefresh
    })
    expect(useAuthStore.getState().user).toEqual(accepted)
    expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(accepted)
  })

  it('does not replace the current account when editing another user', async () => {
    const current = { ...managedUser, id: 99, username: 'current-admin', role: 'admin' }
    useAuthStore.setState({ user: current })
    sessionStorage.setItem('user', JSON.stringify(current))
    const accepted = { ...managedUser, name: '另一用户已修改' }
    vi.mocked(authApi.updateUser).mockResolvedValue({ data: { data: accepted } } as never)
    const user = userEvent.setup()
    render(<UserManagement />)
    await user.click(await screen.findByRole('button', { name: '编辑用户' }))
    const dialog = await screen.findByRole('dialog', { name: '编辑用户' })
    fireEvent.change(within(dialog).getByLabelText(/姓名/), { target: { value: accepted.name } })
    await user.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(authApi.updateUser).toHaveBeenCalledOnce())
    expect(useAuthStore.getState().user).toEqual(current)
    expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(current)
  })

  it('keeps a newer modal draft when a pending edit response arrives', async () => {
    const update = deferred<unknown>()
    vi.mocked(authApi.updateUser).mockReturnValue(update.promise as never)
    const user = userEvent.setup()
    render(<UserManagement />)
    await user.click(await screen.findByRole('button', { name: '编辑用户' }))
    const dialog = await screen.findByRole('dialog', { name: '编辑用户' })
    const name = within(dialog).getByLabelText(/姓名/)
    fireEvent.change(name, { target: { value: '已提交姓名' } })
    await user.click(within(dialog).getByRole('button', { name: '保存' }))
    fireEvent.change(name, { target: { value: '正在继续编辑的新姓名' } })
    await act(async () =>
      update.resolve({ data: { data: { ...managedUser, name: '已提交姓名' } } }),
    )
    expect(screen.getByRole('dialog', { name: '编辑用户' })).toBeInTheDocument()
    expect(name).toHaveValue('正在继续编辑的新姓名')
  })

  it('refreshes the current search after an edit and ignores the pre-edit search response', async () => {
    useAuthStore.setState({ user: { ...managedUser, id: 99, role: 'admin' } })
    const update = deferred<Awaited<ReturnType<typeof authApi.updateUser>>>()
    const oldSearch = deferred<typeof usersResponse>()
    const latestSearch = deferred<typeof usersResponse>()
    vi.mocked(authApi.updateUser).mockReturnValueOnce(update.promise)
    vi.mocked(authApi.getUsers)
      .mockReturnValueOnce(Promise.resolve(usersResponse) as never)
      .mockReturnValueOnce(oldSearch.promise as never)
      .mockReturnValueOnce(latestSearch.promise as never)
    const user = userEvent.setup()
    render(<UserManagement />)
    await user.click(await screen.findByRole('button', { name: '编辑用户' }))
    const dialog = await screen.findByRole('dialog', { name: '编辑用户' })
    await user.click(within(dialog).getByRole('button', { name: '保存' }))

    const search = screen.getByLabelText('搜索用户')
    fireEvent.change(search, { target: { value: 'latest' } })
    fireEvent.keyUp(search, { key: 'Enter' })
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(2))
    const accepted = { ...managedUser, name: '最新用户' }
    await act(async () => update.resolve({ data: { data: accepted } } as never))
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(3))
    expect(authApi.getUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'latest', page: 1 }),
    )

    await act(async () => latestSearch.resolve({ data: { data: { list: [accepted], total: 1 } } }))
    expect(screen.getByText(accepted.name)).toBeInTheDocument()
    await act(async () => oldSearch.resolve(usersResponse))
    expect(screen.getByText(accepted.name)).toBeInTheDocument()
    expect(screen.queryByText(managedUser.name)).not.toBeInTheDocument()
  })

  it('ignores a pending edit after the account changes without refreshing or replacing the new account', async () => {
    const update = deferred<Awaited<ReturnType<typeof authApi.updateUser>>>()
    vi.mocked(authApi.updateUser).mockReturnValueOnce(update.promise)
    const user = userEvent.setup()
    render(<UserManagement />)
    await user.click(await screen.findByRole('button', { name: '编辑用户' }))
    const dialog = await screen.findByRole('dialog', { name: '编辑用户' })
    await user.click(within(dialog).getByRole('button', { name: '保存' }))
    const newAccount = { ...managedUser, id: 99, name: '新账号', role: 'admin' }
    vi.mocked(authApi.getUsers).mockResolvedValueOnce({
      data: { data: { list: [newAccount], total: 1 } },
    } as never)
    act(() => {
      useAuthStore.setState({ token: 'new-session', user: newAccount })
      sessionStorage.setItem('token', 'new-session')
      sessionStorage.setItem('user', JSON.stringify(newAccount))
    })
    await waitFor(() => expect(authApi.getUsers).toHaveBeenCalledTimes(2))
    await act(async () =>
      update.resolve({ data: { data: { ...managedUser, name: '旧账号迟到资料' } } } as never),
    )

    expect(useAuthStore.getState().user).toEqual(newAccount)
    expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(newAccount)
    expect(sessionStorage.getItem('token')).toBe('new-session')
    expect(authApi.getUsers).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('旧账号迟到资料')).not.toBeInTheDocument()
  })

  it('ignores a pending edit after unmount without changing the profile or requesting another list', async () => {
    const update = deferred<Awaited<ReturnType<typeof authApi.updateUser>>>()
    vi.mocked(authApi.updateUser).mockReturnValueOnce(update.promise)
    const currentAccount = useAuthStore.getState().user
    const user = userEvent.setup()
    const view = render(<UserManagement />)
    await user.click(await screen.findByRole('button', { name: '编辑用户' }))
    const dialog = await screen.findByRole('dialog', { name: '编辑用户' })
    await user.click(within(dialog).getByRole('button', { name: '保存' }))
    view.unmount()
    await act(async () =>
      update.resolve({ data: { data: { ...managedUser, name: '离开后的迟到资料' } } } as never),
    )

    expect(useAuthStore.getState().user).toEqual(currentAccount)
    expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(currentAccount)
    expect(authApi.getUsers).toHaveBeenCalledOnce()
  })
})
