import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardApi } from '@/api/dashboard'
import { usePaymentSummary } from './usePaymentSummary'

vi.mock('@/api/dashboard', () => ({
  dashboardApi: { getStats: vi.fn(), getReceiptOverview: vi.fn() },
}))

const statsResponse = (paid: number, pending: number, overdue = 0, periodReceived = 25) =>
  ({
    data: {
      data: {
        contract_received: paid,
        received_total: paid + overdue,
        outstanding_total: pending,
        overpaid_total: overdue,
        period_received: periodReceived,
        period_count: 1,
      },
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
    vi.resetAllMocks()
    vi.mocked(dashboardApi.getStats).mockResolvedValue({
      data: { data: { paid_amount: 7, pending_amount: 0 } },
    } as never)
  })

  it('loads the all-time collected and outstanding amounts', async () => {
    vi.mocked(dashboardApi.getReceiptOverview).mockResolvedValue(statsResponse(3600, 2400, 800))

    const { result } = renderHook(() => usePaymentSummary())
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('data'))
    // A contract's excess receipts cannot erase another contract's outstanding amount.
    expect(result.current).toMatchObject({
      paid: 3600,
      pending: 2400,
      overpaid: 800,
    })
    expect(result.current).not.toHaveProperty('periodReceived')
    expect(dashboardApi.getReceiptOverview).toHaveBeenCalledWith('all', expect.any(AbortSignal))
  })

  it('reports a failure and recovers on retry', async () => {
    vi.mocked(dashboardApi.getReceiptOverview)
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
    vi.mocked(dashboardApi.getReceiptOverview)
      .mockResolvedValueOnce(statsResponse(100, 50))
      .mockReturnValueOnce(refresh.promise)

    const { result } = renderHook(() => usePaymentSummary())
    await waitFor(() => expect(result.current.status).toBe('data'))

    act(() => {
      void result.current.retry()
    })
    expect(result.current).toMatchObject({ paid: 100, pending: 50, status: 'data' })
    expect(result.current.refreshing).toBe(true)

    await act(async () => {
      refresh.resolve(statsResponse(150, 0))
      await refresh.promise
    })
    expect(result.current).toMatchObject({ paid: 150, pending: 0, status: 'data' })
    expect(result.current.refreshing).toBe(false)
  })

  it('ignores a response that arrives after the workbench was left', async () => {
    const pending = createDeferred<never>()
    vi.mocked(dashboardApi.getReceiptOverview).mockReturnValue(pending.promise)

    const { result, unmount } = renderHook(() => usePaymentSummary())
    await waitFor(() => expect(dashboardApi.getReceiptOverview).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(dashboardApi.getReceiptOverview).mock.calls[0][1]!

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
    vi.mocked(dashboardApi.getReceiptOverview)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(statsResponse(900, 100))

    const { result } = renderHook(() => usePaymentSummary())
    await waitFor(() => expect(dashboardApi.getReceiptOverview).toHaveBeenCalledTimes(1))

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
    vi.mocked(dashboardApi.getReceiptOverview).mockResolvedValue(statsResponse(1, 2))

    const { rerender, result } = renderHook(({ scope }) => usePaymentSummary(scope), {
      initialProps: { scope: 'year' as 'month' | 'year' },
    })
    await waitFor(() => expect(result.current.status).toBe('data'))
    expect(dashboardApi.getReceiptOverview).toHaveBeenLastCalledWith(
      'year',
      expect.any(AbortSignal),
    )

    rerender({ scope: 'month' })
    await waitFor(() =>
      expect(dashboardApi.getReceiptOverview).toHaveBeenLastCalledWith(
        'month',
        expect.any(AbortSignal),
      ),
    )
  })

  it('does not overwrite the selected signing scope with a late response from an older scope', async () => {
    const oldScope = createDeferred<never>()
    vi.mocked(dashboardApi.getReceiptOverview)
      .mockReturnValueOnce(oldScope.promise)
      .mockResolvedValueOnce(statsResponse(300, 700, 0, 9000))
    const { rerender, result } = renderHook(({ scope }) => usePaymentSummary(scope), {
      initialProps: { scope: 'all' as 'all' | 'month' },
    })
    await waitFor(() => expect(dashboardApi.getReceiptOverview).toHaveBeenCalledOnce())
    const oldSignal = vi.mocked(dashboardApi.getReceiptOverview).mock.calls[0][1]!

    rerender({ scope: 'month' })
    await waitFor(() => expect(result.current.status).toBe('data'))
    expect(oldSignal.aborted).toBe(true)
    await act(async () => {
      oldScope.resolve(statsResponse(3600, 2400))
      await oldScope.promise
    })
    expect(result.current).toMatchObject({
      paid: 300,
      pending: 700,
      scope: 'month',
      status: 'data',
    })
  })

  it('marks a new scope loading before its request starts so old amounts are not relabelled', async () => {
    const next = createDeferred<never>()
    vi.mocked(dashboardApi.getReceiptOverview)
      .mockResolvedValueOnce(statsResponse(900, 100))
      .mockReturnValueOnce(next.promise)
    const { rerender, result } = renderHook(({ scope }) => usePaymentSummary(scope), {
      initialProps: { scope: 'all' as 'all' | 'month' },
    })
    await waitFor(() => expect(result.current.status).toBe('data'))

    rerender({ scope: 'month' })
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(dashboardApi.getReceiptOverview).toHaveBeenCalledTimes(2))
    await act(async () => {
      next.resolve(statsResponse(20, 80, 0, 900))
      await next.promise
    })
    expect(result.current).toMatchObject({
      paid: 20,
      pending: 80,
      status: 'data',
    })
  })
})
