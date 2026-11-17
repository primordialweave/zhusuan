import PaymentSummary from '@/components/dashboard/PaymentSummary'
import { usePaymentSummary } from './dashboard/usePaymentSummary'

/** The workbench is the scene itself; the payment summary is the only thing placed on it. */
export default function DashboardView() {
  const { paid, pending, retry, status } = usePaymentSummary()

  return (
    <div className="workbench">
      <h1 className="ods-sr-only">工作台</h1>
      <PaymentSummary onRetry={retry} paid={paid} pending={pending} status={status} />
    </div>
  )
}
