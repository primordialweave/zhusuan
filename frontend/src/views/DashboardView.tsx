import { useState } from 'react'
import PaymentSummary from '@/components/dashboard/PaymentSummary'
import {
  PAYMENT_SUMMARY_SCOPES,
  type PaymentSummaryScope,
} from '@/components/dashboard/paymentSummaryScope'
import { usePaymentSummary } from './dashboard/usePaymentSummary'

const SCOPE_KEY = 'workbenchSummaryScope'

const readScope = (): PaymentSummaryScope => {
  const saved = typeof window === 'undefined' ? null : window.localStorage.getItem(SCOPE_KEY)
  return PAYMENT_SUMMARY_SCOPES.find((scope) => scope === saved) ?? 'month'
}

/** The workbench is the scene itself; the payment summary is the only thing placed on it. */
export default function DashboardView() {
  const [scope, setScope] = useState(readScope)
  const { paid, pending, overpaid, refreshing, retry, status } = usePaymentSummary(scope)

  const changeScope = (next: PaymentSummaryScope) => {
    setScope(next)
    window.localStorage.setItem(SCOPE_KEY, next)
  }

  return (
    <div className="workbench">
      <h1 className="ods-sr-only">工作台</h1>
      <PaymentSummary
        onRetry={retry}
        onScopeChange={changeScope}
        paid={paid}
        pending={pending}
        overpaid={overpaid}
        refreshing={refreshing}
        scope={scope}
        status={status}
      />
    </div>
  )
}
