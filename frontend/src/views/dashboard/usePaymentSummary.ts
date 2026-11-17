import { useCallback, useEffect, useRef, useState } from 'react'
import { dashboardApi } from '@/api/dashboard'
import type { PaymentSummaryStatus } from '@/components/dashboard/PaymentSummary'

interface PaymentSummaryState {
  paid: number
  pending: number
  status: PaymentSummaryStatus
}

/**
 * All-time collected and outstanding amounts for the workbench.
 *
 * The unscoped stats already count overdue money inside `pending_amount`, so the two values
 * are the whole picture and must not be combined with `overdue_amount`.
 */
export function usePaymentSummary() {
  const [state, setState] = useState<PaymentSummaryState>({
    paid: 0,
    pending: 0,
    status: 'loading',
  })
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState((current) => (current.status === 'data' ? current : { ...current, status: 'loading' }))

    try {
      const response = await dashboardApi.getStats(undefined, controller.signal)
      if (controller.signal.aborted) return
      const stats = response.data.data
      setState({ paid: stats.paid_amount, pending: stats.pending_amount, status: 'data' })
    } catch {
      if (controller.signal.aborted) return
      setState((current) => ({ ...current, status: 'error' }))
    }
  }, [])

  useEffect(() => {
    // Mounting again (returning from another page) is the refresh trigger.
    const timer = window.setTimeout(load, 0)
    return () => {
      window.clearTimeout(timer)
      controllerRef.current?.abort()
    }
  }, [load])

  return { ...state, retry: load }
}
