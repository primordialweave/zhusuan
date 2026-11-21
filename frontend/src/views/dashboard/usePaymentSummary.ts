import { useCallback, useEffect, useRef, useState } from 'react'
import { dashboardApi } from '@/api/dashboard'
import type { PaymentSummaryStatus } from '@/components/dashboard/PaymentSummary'
import type { PaymentSummaryScope } from '@/components/dashboard/paymentSummaryScope'

interface PaymentSummaryState {
  paid: number
  pending: number
  refreshing: boolean
  scope: PaymentSummaryScope
  status: PaymentSummaryStatus
}

const requestScope = (scope: PaymentSummaryScope) => {
  if (scope === 'all') return undefined
  const today = new Date()
  return { month: scope === 'month' ? today.getMonth() + 1 : 0, year: today.getFullYear() }
}

/**
 * Collected and outstanding amounts for the workbench: all time, this year or this month.
 *
 * The stats already count overdue money inside `pending_amount`, so the two values are the
 * whole picture and must not be combined with `overdue_amount`.
 */
export function usePaymentSummary(scope: PaymentSummaryScope = 'all') {
  const [state, setState] = useState<PaymentSummaryState>({
    paid: 0,
    pending: 0,
    refreshing: false,
    scope,
    status: 'loading',
  })
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState((current) =>
      current.status === 'data' && current.scope === scope
        ? { ...current, refreshing: true }
        : { ...current, refreshing: false, scope, status: 'loading' },
    )

    try {
      const response = await dashboardApi.getStats(requestScope(scope), controller.signal)
      if (controller.signal.aborted) return
      const stats = response.data.data
      setState({
        paid: stats.paid_amount,
        pending: stats.pending_amount,
        refreshing: false,
        scope,
        status: 'data',
      })
    } catch {
      if (controller.signal.aborted) return
      setState((current) => ({ ...current, refreshing: false, scope, status: 'error' }))
    }
  }, [scope])

  useEffect(() => {
    // Mounting again (returning from another page) and changing scope both load afresh.
    const timer = window.setTimeout(load, 0)
    return () => {
      window.clearTimeout(timer)
      controllerRef.current?.abort()
    }
  }, [load])

  return {
    ...state,
    retry: load,
    status: state.scope === scope ? state.status : ('loading' as const),
  }
}
