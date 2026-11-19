import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const expired = (config: InternalAxiosRequestConfig) => ({
  config,
  response: { status: 401, data: { code: 2001, message: 'expired' }, config },
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('API expired-session handling', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('handles a second expiry after the user signs in again', async () => {
    const { default: api, setAuthLogout } = await import('./index')
    const logout = vi.fn(() => sessionStorage.removeItem('token'))
    setAuthLogout(logout)
    api.defaults.adapter = async (config) => {
      throw expired(config)
    }
    sessionStorage.setItem('token', 'first-session')
    await expect(api.get('/projects')).rejects.toThrow('expired')
    await vi.waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
    sessionStorage.setItem('token', 'second-session')
    await expect(api.get('/projects')).rejects.toThrow('expired')
    await vi.waitFor(() => expect(logout).toHaveBeenCalledTimes(2))
  })

  it('keeps concurrent failures from the same session single flight', async () => {
    const { default: api, setAuthLogout } = await import('./index')
    const finish = deferred<void>()
    const logout = vi.fn(async () => {
      await finish.promise
      sessionStorage.removeItem('token')
    })
    setAuthLogout(logout)
    api.defaults.adapter = async (config) => {
      throw expired(config)
    }
    sessionStorage.setItem('token', 'first-session')
    await Promise.allSettled([api.get('/projects'), api.get('/dashboard'), api.get('/calendar')])
    expect(logout).toHaveBeenCalledTimes(1)
    finish.resolve(undefined)
    await finish.promise
  })

  it('ignores a late old-session 401 after a new login succeeds', async () => {
    const { default: api, setAuthLogout } = await import('./index')
    const response = deferred<never>()
    let requestConfig!: InternalAxiosRequestConfig
    api.defaults.adapter = (config) => {
      requestConfig = config
      return response.promise
    }
    const logout = vi.fn(() => sessionStorage.removeItem('token'))
    setAuthLogout(logout)
    sessionStorage.setItem('token', 'first-session')
    const request = api.get('/projects')
    await vi.waitFor(() => expect(requestConfig).toBeDefined())
    sessionStorage.setItem('token', 'second-session')
    response.reject(expired(requestConfig))
    await expect(request).rejects.toThrow('expired')
    expect(logout).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('token')).toBe('second-session')
  })

  it('ignores a late old-session business expiry response', async () => {
    const { default: api, setAuthLogout } = await import('./index')
    const response = deferred<AxiosResponse>()
    let requestConfig!: InternalAxiosRequestConfig
    api.defaults.adapter = (config) => {
      requestConfig = config
      return response.promise
    }
    const logout = vi.fn(() => sessionStorage.removeItem('token'))
    setAuthLogout(logout)
    sessionStorage.setItem('token', 'first-session')
    const request = api.get('/projects')
    await vi.waitFor(() => expect(requestConfig).toBeDefined())
    sessionStorage.setItem('token', 'second-session')
    response.resolve({
      data: { code: 2002, message: 'expired' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
    } as never)
    await expect(request).rejects.toThrow('登录已过期')
    expect(logout).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('token')).toBe('second-session')
  })
})
