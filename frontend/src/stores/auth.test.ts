import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { useAuthStore } from './auth'

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}))

const userA = { id: 1, username: 'user-a', name: 'A', role: 'admin' }
const userB = { id: 2, username: 'user-b', name: 'B', role: 'user' }
const reply = <T>(data: T) => ({ data: { data } })
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('auth session changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    sessionStorage.setItem('token', 'session-a')
    sessionStorage.setItem('user', JSON.stringify(userA))
    useAuthStore.setState({
      token: 'session-a',
      user: userA as never,
      isLoggedIn: true,
      isAuthenticated: true,
      loading: false,
      error: null,
    })
    vi.mocked(authApi.logout).mockResolvedValue(reply(null) as never)
    vi.mocked(authApi.login).mockResolvedValue(reply({ token: 'session-b', user: userB }) as never)
  })

  const switchUser = async () => {
    await useAuthStore.getState().logout()
    await useAuthStore.getState().login({ username: 'user-b', password: 'fixture' })
  }

  it('does not replace the new user with an old profile response', async () => {
    const response = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    vi.mocked(authApi.getCurrentUser).mockReturnValue(response.promise)
    const refresh = useAuthStore.getState().refreshUser()
    await switchUser()
    response.resolve(reply(userA) as never)
    await refresh
    expect(useAuthStore.getState().user?.id).toBe(2)
    expect(JSON.parse(sessionStorage.getItem('user')!).id).toBe(2)
  })

  it('does not log the new user out for an old failed profile response', async () => {
    const response = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    vi.mocked(authApi.getCurrentUser).mockReturnValue(response.promise)
    const refresh = useAuthStore.getState().refreshUser()
    await switchUser()
    response.reject(new Error('old request failed'))
    await refresh
    expect(useAuthStore.getState().token).toBe('session-b')
    expect(authApi.logout).toHaveBeenCalledTimes(1)
  })

  it('keeps a valid session on temporary profile network errors', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('temporary network failure'))
    await useAuthStore.getState().refreshUser()
    expect(useAuthStore.getState().token).toBe('session-a')
    expect(authApi.logout).not.toHaveBeenCalled()
  })

  it('does not clear a new login when an older logout response arrives', async () => {
    const response = deferred<Awaited<ReturnType<typeof authApi.logout>>>()
    vi.mocked(authApi.logout).mockReturnValue(response.promise)
    const logout = useAuthStore.getState().logout()
    await useAuthStore.getState().login({ username: 'user-b', password: 'fixture' })
    response.resolve(reply(null) as never)
    await logout
    expect(useAuthStore.getState().token).toBe('session-b')
    expect(sessionStorage.getItem('token')).toBe('session-b')
  })

  it('does not let an earlier login replace the latest accepted account', async () => {
    const old = deferred<Awaited<ReturnType<typeof authApi.login>>>()
    const latest = deferred<Awaited<ReturnType<typeof authApi.login>>>()
    vi.mocked(authApi.login)
      .mockReset()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise)
    const first = useAuthStore.getState().login({ username: 'user-a', password: 'fixture' })
    const second = useAuthStore.getState().login({ username: 'user-b', password: 'fixture' })
    latest.resolve(reply({ token: 'latest-token', user: userB }) as never)
    expect(await second).toBe(true)
    old.resolve(reply({ token: 'old-token', user: userA }) as never)
    expect(await first).toBe(false)
    expect(useAuthStore.getState().token).toBe('latest-token')
    expect(sessionStorage.getItem('token')).toBe('latest-token')
  })

  it('does not restore a login cancelled by logout or display its late failure', async () => {
    const pending = deferred<Awaited<ReturnType<typeof authApi.login>>>()
    vi.mocked(authApi.login).mockReturnValueOnce(pending.promise)
    const login = useAuthStore.getState().login({ username: 'user-b', password: 'fixture' })
    await useAuthStore.getState().logout()
    pending.resolve(reply({ token: 'cancelled-token', user: userB }) as never)
    expect(await login).toBe(false)
    expect(useAuthStore.getState().token).toBeNull()
    expect(sessionStorage.getItem('token')).toBeNull()

    const failed = deferred<Awaited<ReturnType<typeof authApi.login>>>()
    vi.mocked(authApi.login).mockReturnValueOnce(failed.promise)
    const stale = useAuthStore.getState().login({ username: 'user-a', password: 'fixture' })
    await useAuthStore.getState().logout()
    failed.reject(new Error('late login failure'))
    expect(await stale).toBe(false)
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('does not replace the new session user with a completed old profile edit', async () => {
    const response = deferred<Awaited<ReturnType<typeof authApi.updateProfile>>>()
    vi.mocked(authApi.updateProfile).mockReturnValue(response.promise)
    const update = useAuthStore.getState().updateProfile({ name: 'edited A' })
    await switchUser()
    response.resolve(reply({ ...userA, name: 'edited A' }) as never)
    await update
    expect(useAuthStore.getState().user?.id).toBe(2)
  })

  it('does not overwrite an accepted profile edit with a refresh that started before it', async () => {
    const oldRefresh = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    vi.mocked(authApi.getCurrentUser).mockReturnValueOnce(oldRefresh.promise)
    const refresh = useAuthStore.getState().refreshUser()
    const accepted = { ...userA, name: 'accepted name' }
    vi.mocked(authApi.updateProfile).mockResolvedValueOnce(reply(accepted) as never)
    expect(await useAuthStore.getState().updateProfile({ name: accepted.name })).toBe(true)
    oldRefresh.resolve(reply(userA) as never)
    await refresh
    expect(useAuthStore.getState().user?.name).toBe(accepted.name)
    expect(JSON.parse(sessionStorage.getItem('user')!).name).toBe(accepted.name)
  })

  it('keeps the newest profile refresh when responses arrive out of order', async () => {
    const old = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    const latest = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    vi.mocked(authApi.getCurrentUser)
      .mockReset()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise)
    const first = useAuthStore.getState().refreshUser()
    const second = useAuthStore.getState().refreshUser()
    latest.resolve(reply({ ...userA, name: 'latest profile' }) as never)
    await second
    old.resolve(reply(userA) as never)
    await first
    expect(useAuthStore.getState().user?.name).toBe('latest profile')
  })

  it('does not accept an earlier session refresh after login reuses the same token and user ID', async () => {
    const old = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    vi.mocked(authApi.getCurrentUser).mockReturnValueOnce(old.promise)
    const refresh = useAuthStore.getState().refreshUser()
    await useAuthStore.getState().logout()
    vi.mocked(authApi.login).mockResolvedValueOnce(
      reply({ token: 'session-a', user: { ...userA, name: 'new login' } }) as never,
    )
    await useAuthStore.getState().login({ username: 'user-a', password: 'fixture' })
    old.resolve(reply(userA) as never)
    await refresh
    expect(useAuthStore.getState().user?.name).toBe('new login')
  })

  it('does not synchronize another user into the current session', () => {
    const session = useAuthStore.getState().captureSession()
    expect(useAuthStore.getState().syncCurrentUser(userB as never, session)).toBe(false)
    expect(useAuthStore.getState().user).toEqual(userA)
    expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(userA)
  })

  it('ignores an older profile edit after an admin edit has synchronized the accepted profile', async () => {
    const response = deferred<Awaited<ReturnType<typeof authApi.updateProfile>>>()
    vi.mocked(authApi.updateProfile).mockReturnValueOnce(response.promise)
    const update = useAuthStore.getState().updateProfile({ name: 'old profile edit' })
    const accepted = { ...userA, name: 'accepted admin edit' }
    const session = useAuthStore.getState().captureSession()
    expect(useAuthStore.getState().syncCurrentUser(accepted as never, session)).toBe(true)
    response.resolve(reply({ ...userA, name: 'old profile edit' }) as never)
    expect(await update).toBe(false)
    expect(useAuthStore.getState().user).toEqual(accepted)
    expect(useAuthStore.getState().loading).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(accepted)
  })

  it('clears the local session when the current account is disabled and ignores an old refresh', async () => {
    const old = deferred<Awaited<ReturnType<typeof authApi.getCurrentUser>>>()
    vi.mocked(authApi.getCurrentUser).mockReturnValueOnce(old.promise)
    const refresh = useAuthStore.getState().refreshUser()
    const session = useAuthStore.getState().captureSession()
    expect(useAuthStore.getState().syncCurrentUser({ ...userA, status: 0 } as never, session)).toBe(
      true,
    )
    old.resolve(reply(userA) as never)
    await refresh
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(sessionStorage.getItem('user')).toBeNull()
    expect(sessionStorage.getItem('token')).toBeNull()
  })
})
