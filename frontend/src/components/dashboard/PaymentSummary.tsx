import { Button, Surface } from '@/design-system'
import { formatAmount } from '@/utils/format'

export type PaymentSummaryStatus = 'loading' | 'data' | 'error'

export interface PaymentSummaryProps {
  onRetry?: () => void
  /** 已收款金额。 */
  paid: number
  /** 待收款金额，已包含逾期；超收时为负数。 */
  pending: number
  status: PaymentSummaryStatus
}

const PIE_RADIUS = 16

/** A wedge from twelve o'clock, clockwise, covering the given share of the circle. */
const wedgePath = (share: number) => {
  const angle = share * Math.PI * 2
  const x = PIE_RADIUS + PIE_RADIUS * Math.sin(angle)
  const y = PIE_RADIUS - PIE_RADIUS * Math.cos(angle)
  return `M${PIE_RADIUS} ${PIE_RADIUS}L${PIE_RADIUS} 0A${PIE_RADIUS} ${PIE_RADIUS} 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)}Z`
}

function SummaryPie({ paid, pending }: { paid: number; pending: number }) {
  // Negative amounts carry accounting meaning in the text; they never draw a negative slice.
  const paidPart = Math.max(0, paid)
  const pendingPart = Math.max(0, pending)
  const total = paidPart + pendingPart
  const paidShare = total > 0 ? paidPart / total : 0
  const label =
    total > 0
      ? `已收 ${Math.round(paidShare * 100)}%，待收 ${100 - Math.round(paidShare * 100)}%`
      : '暂无收款数据'

  return (
    <svg aria-label={label} className="payment-summary__pie" role="img" viewBox="0 0 32 32">
      {total === 0 ? (
        <circle cx={PIE_RADIUS} cy={PIE_RADIUS} data-part="none" r={PIE_RADIUS - 1} />
      ) : (
        <>
          <circle
            cx={PIE_RADIUS}
            cy={PIE_RADIUS}
            data-part={paidShare >= 1 ? 'paid' : 'pending'}
            r={PIE_RADIUS}
          />
          {paidShare > 0 && paidShare < 1 ? (
            <path d={wedgePath(paidShare)} data-part="paid" />
          ) : null}
        </>
      )}
    </svg>
  )
}

/** The workbench's only data: how much has been collected and how much is still due. */
export default function PaymentSummary({ onRetry, paid, pending, status }: PaymentSummaryProps) {
  const loading = status === 'loading'
  const empty = status === 'data' && paid === 0 && pending === 0
  const overpaid = status === 'data' && pending < 0

  return (
    <Surface
      as="section"
      aria-busy={loading || undefined}
      aria-label="收款摘要"
      className="payment-summary"
      padding="none"
      radius="pill"
      variant="glass"
    >
      <SummaryPie paid={status === 'data' ? paid : 0} pending={status === 'data' ? pending : 0} />
      {status === 'error' ? (
        <div className="payment-summary__message" role="alert">
          <span>收款数据加载失败</span>
          {onRetry ? (
            <Button onClick={onRetry} size="sm" variant="ghost">
              重试
            </Button>
          ) : null}
        </div>
      ) : empty ? (
        <div className="payment-summary__message">暂无收款数据</div>
      ) : (
        <dl className="payment-summary__legend">
          <div className="payment-summary__row">
            <span aria-hidden="true" className="payment-summary__dot" data-part="paid" />
            <dt className="payment-summary__label">已收款金额</dt>
            <dd className="payment-summary__amount">{loading ? '—' : formatAmount(paid)}</dd>
          </div>
          <div className="payment-summary__row">
            <span aria-hidden="true" className="payment-summary__dot" data-part="pending" />
            <dt className="payment-summary__label">{overpaid ? '已超收' : '待收款金额'}</dt>
            <dd className="payment-summary__amount">
              {loading ? '—' : formatAmount(Math.abs(pending))}
            </dd>
          </div>
        </dl>
      )}
    </Surface>
  )
}
