import { useState } from 'react'
import PaymentSummary from '@/components/dashboard/PaymentSummary'
import type { PaymentSummaryScope } from '@/components/dashboard/paymentSummaryScope'
import { usePaymentSummary } from './dashboard/usePaymentSummary'

/** The workbench is the scene itself; the payment summary is the only thing placed on it. */
export default function DashboardView() {
  const [scope, setScope] = useState<PaymentSummaryScope>('all')
  const { paid, pending, overpaid, refreshing, retry, status } = usePaymentSummary(scope)

  return (
    <div className="workbench">
      <h1 className="ods-sr-only">工作台</h1>
      <PaymentSummary
        onRetry={retry}
        onScopeChange={setScope}
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
