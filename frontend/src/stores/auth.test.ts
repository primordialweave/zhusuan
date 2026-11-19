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

  it('does not replace the new session user with a completed old profile edit', async () => {
    const response = deferred<Awaited<ReturnType<typeof authApi.updateProfile>>>()
    vi.mocked(authApi.updateProfile).mockReturnValue(response.promise)
    const update = useAuthStore.getState().updateProfile({ name: 'edited A' })
    await switchUser()
    response.resolve(reply({ ...userA, name: 'edited A' }) as never)
    await update
    expect(useAuthStore.getState().user?.id).toBe(2)
  })
})
