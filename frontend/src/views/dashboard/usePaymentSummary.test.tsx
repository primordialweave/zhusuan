import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardApi } from '@/api/dashboard'
import { usePaymentSummary } from './usePaymentSummary'

vi.mock('@/api/dashboard', () => ({
  dashboardApi: { getStats: vi.fn() },
}))

const statsResponse = (paid: number, pending: number, overdue = 0) =>
  ({
    data: {
      data: { overdue_amount: overdue, paid_amount: paid, pending_amount: pending },
    },
  }) as never

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

describe('usePaymentSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the all-time collected and outstanding amounts', async () => {
    vi.mocked(dashboardApi.getStats).mockResolvedValue(statsResponse(3600, 2400, 800))

    const { result } = renderHook(() => usePaymentSummary())
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('data'))
    // Overdue money is already inside pending, so it is not added a second time.
    expect(result.current).toMatchObject({ paid: 3600, pending: 2400 })
    expect(dashboardApi.getStats).toHaveBeenCalledWith(undefined, expect.any(AbortSignal))
  })

  it('reports a failure and recovers on retry', async () => {
    vi.mocked(dashboardApi.getStats)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(statsResponse(100, 50))

    const { result } = renderHook(() => usePaymentSummary())
    await waitFor(() => expect(result.current.status).toBe('error'))

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current).toMatchObject({ paid: 100, pending: 50, status: 'data' })
  })

  it('keeps showing loaded amounts while a refresh is in flight', async () => {
    const refresh = createDeferred<never>()
    vi.mocked(dashboardApi.getStats)
      .mockResolvedValueOnce(statsResponse(100, 50))
      .mockReturnValueOnce(refresh.promise)

    const { result } = renderHook(() => usePaymentSummary())
    await waitFor(() => expect(result.current.status).toBe('data'))

    act(() => {
      void result.current.retry()
    })
    expect(result.current).toMatchObject({ paid: 100, pending: 50, status: 'data' })

    await act(async () => {
      refresh.resolve(statsResponse(150, 0))
      await refresh.promise
    })
    expect(result.current).toMatchObject({ paid: 150, pending: 0, status: 'data' })
  })

  it('ignores a response that arrives after the workbench was left', async () => {
    const pending = createDeferred<never>()
    vi.mocked(dashboardApi.getStats).mockReturnValue(pending.promise)

    const { result, unmount } = renderHook(() => usePaymentSummary())
    await waitFor(() => expect(dashboardApi.getStats).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(dashboardApi.getStats).mock.calls[0][1]!

    unmount()
    expect(signal.aborted).toBe(true)

    await act(async () => {
      pending.resolve(statsResponse(1, 1))
      await pending.promise
    })
    expect(result.current.status).toBe('loading')
  })

  it('lets a newer request win over an older one', async () => {
    const first = createDeferred<never>()
    vi.mocked(dashboardApi.getStats)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(statsResponse(900, 100))

    const { result } = renderHook(() => usePaymentSummary())
    await waitFor(() => expect(dashboardApi.getStats).toHaveBeenCalledTimes(1))

    await act(async () => {
      await result.current.retry()
    })
    await act(async () => {
      first.resolve(statsResponse(1, 1))
      await first.promise
    })

    expect(result.current).toMatchObject({ paid: 900, pending: 100, status: 'data' })
  })

  it('asks for this calendar year or month when the scope narrows', async () => {
    vi.mocked(dashboardApi.getStats).mockResolvedValue(statsResponse(1, 2))
    const today = new Date()

    const { rerender, result } = renderHook(({ scope }) => usePaymentSummary(scope), {
      initialProps: { scope: 'year' as 'month' | 'year' },
    })
    await waitFor(() => expect(result.current.status).toBe('data'))
    expect(dashboardApi.getStats).toHaveBeenLastCalledWith(
      { month: 0, year: today.getFullYear() },
      expect.any(AbortSignal),
    )

    rerender({ scope: 'month' })
    await waitFor(() =>
      expect(dashboardApi.getStats).toHaveBeenLastCalledWith(
        { month: today.getMonth() + 1, year: today.getFullYear() },
        expect.any(AbortSignal),
      ),
    )
  })
})
