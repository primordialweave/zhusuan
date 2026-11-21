import { Button, Skeleton, Surface } from '@/design-system'
import { formatAmount } from '@/utils/format'
import { PAYMENT_SUMMARY_SCOPES, type PaymentSummaryScope } from './paymentSummaryScope'

export type PaymentSummaryStatus = 'loading' | 'data' | 'error'

const scopeCopy: Record<PaymentSummaryScope, { name: string; paid: string; pending: string }> = {
  all: { name: '全部', paid: '已收款金额', pending: '待收款金额' },
  month: { name: '本月', paid: '本月已收款', pending: '本月待收款' },
  year: { name: '本年', paid: '本年已收款', pending: '本年待收款' },
}

export interface PaymentSummaryProps {
  onRetry?: () => void
  /** Pressing the pie moves on to the next scope. */
  onScopeChange?: (scope: PaymentSummaryScope) => void
  /** 已收款金额。 */
  paid: number
  /** 待收款金额，已包含逾期；超收时为负数。 */
  pending: number
  refreshing?: boolean
  scope?: PaymentSummaryScope
  status: PaymentSummaryStatus
}

const PIE_RADIUS = 16
// A stroke as wide as the circle it runs on fills the whole disc, so the paid share is a dash
// length, and a dash length can ease from one value to the next where a path cannot.
const SLICE_RADIUS = PIE_RADIUS / 2
const SLICE_CIRCUMFERENCE = 2 * Math.PI * SLICE_RADIUS

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
      <circle
        cx={PIE_RADIUS}
        cy={PIE_RADIUS}
        data-part={total === 0 ? 'none' : 'pending'}
        r={total === 0 ? PIE_RADIUS - 1 : PIE_RADIUS}
      />
      <circle
        cx={PIE_RADIUS}
        cy={PIE_RADIUS}
        data-part="paid"
        r={SLICE_RADIUS}
        strokeDasharray={`${(paidShare * SLICE_CIRCUMFERENCE).toFixed(3)} ${SLICE_CIRCUMFERENCE.toFixed(3)}`}
        transform={`rotate(-90 ${PIE_RADIUS} ${PIE_RADIUS})`}
      />
    </svg>
  )
}

/** The workbench's only data: how much has been collected and how much is still due. */
export default function PaymentSummary({
  onRetry,
  onScopeChange,
  paid,
  pending,
  refreshing = false,
  scope = 'all',
  status,
}: PaymentSummaryProps) {
  const loading = status === 'loading'
  const empty = status === 'data' && paid === 0 && pending === 0
  const overpaid = status === 'data' && pending < 0
  const copy = scopeCopy[scope]
  const next =
    PAYMENT_SUMMARY_SCOPES[
      (PAYMENT_SUMMARY_SCOPES.indexOf(scope) + 1) % PAYMENT_SUMMARY_SCOPES.length
    ]
  const pie = loading ? (
    <Skeleton className="payment-summary__pie" shape="circle" />
  ) : (
    <SummaryPie paid={status === 'data' ? paid : 0} pending={status === 'data' ? pending : 0} />
  )

  return (
    <Surface
      as="section"
      aria-busy={loading || refreshing || undefined}
      aria-label="收款摘要"
      className="payment-summary"
      data-scope={scope}
      padding="none"
      radius="pill"
      variant="glass"
    >
      {loading || refreshing ? (
        <span className="ods-sr-only" role="status">
          正在加载收款摘要
        </span>
      ) : null}
      {onScopeChange ? (
        <Button
          aria-label={`统计范围：${copy.name}，点击切换到${scopeCopy[next].name}`}
          className="payment-summary__switch"
          onClick={() => onScopeChange(next)}
          title={`切换到${scopeCopy[next].name}`}
          variant="bare"
        >
          {pie}
        </Button>
      ) : (
        pie
      )}
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
        <div className="payment-summary__message">
          {copy.name === '全部' ? '' : copy.name}暂无收款数据
        </div>
      ) : (
        <dl aria-live="polite" className="payment-summary__legend" key={scope}>
          <div className="payment-summary__row">
            <span aria-hidden="true" className="payment-summary__dot" data-part="paid" />
            <dt className="payment-summary__label">{copy.paid}</dt>
            <dd className="payment-summary__amount">
              {loading ? (
                <Skeleton
                  className="payment-summary__amount-placeholder"
                  height="1.2em"
                  width="5.5rem"
                />
              ) : (
                formatAmount(paid)
              )}
            </dd>
          </div>
          <div className="payment-summary__row">
            <span aria-hidden="true" className="payment-summary__dot" data-part="pending" />
            <dt className="payment-summary__label">
              {overpaid ? `${scope === 'all' ? '' : copy.name}已超收` : copy.pending}
            </dt>
            <dd className="payment-summary__amount">
              {loading ? (
                <Skeleton
                  className="payment-summary__amount-placeholder"
                  height="1.2em"
                  width="5.5rem"
                />
              ) : (
                formatAmount(Math.abs(pending))
              )}
            </dd>
          </div>
        </dl>
      )}
      {refreshing && !loading ? <Skeleton className="payment-summary__refresh-skeleton" /> : null}
    </Surface>
  )
}
