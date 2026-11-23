import { useId } from 'react'
import { Button, Skeleton, Surface, Tooltip } from '@/design-system'
import { usePrivacyMode } from '@/stores/desktop'
import { formatAmount, maskAmount } from '@/utils/format'
import { PAYMENT_SUMMARY_SCOPES, type PaymentSummaryScope } from './paymentSummaryScope'

export type PaymentSummaryStatus = 'loading' | 'data' | 'error'

const contractScopes: Record<PaymentSummaryScope, string> = {
  all: '全部合同',
  year: '本年签约',
  month: '本月签约',
}

const scopePrefixes: Record<PaymentSummaryScope, string> = {
  all: '全部',
  year: '本年',
  month: '本月',
}

export interface PaymentSummaryProps {
  onRetry?: () => void
  /** Clicking the pie cycles contracts grouped by their signing date. */
  onScopeChange?: (scope: PaymentSummaryScope) => void
  /** 已收合同款；每个项目最多计至该项目的合同总额。 */
  paid: number
  /** 所选签约周期的合同未收金额，超收不抵消其他项目余额。 */
  pending: number
  overpaid?: number
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
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  // Negative amounts carry accounting meaning in the text; they never draw a negative slice.
  const paidPart = Math.max(0, paid)
  const pendingPart = Math.max(0, pending)
  const total = paidPart + pendingPart
  const paidShare = total > 0 ? paidPart / total : 0
  const label =
    total > 0
      ? `合同已收 ${Math.round(paidShare * 100)}%，合同未收 ${100 - Math.round(paidShare * 100)}%`
      : '暂无合同数据'
  const domeVolumeId = `summary-pie-volume-${uid}`
  const bounceId = `summary-pie-bounce-${uid}`
  const catchlightId = `summary-pie-catchlight-${uid}`
  const rimId = `summary-pie-rim-${uid}`

  return (
    <svg
      aria-label={label}
      className="payment-summary__pie payment-summary__pie-svg"
      role="img"
      viewBox="0 0 32 32"
    >
      <defs>
        {/* Convex jade cabochon volume: sunlit dome curving into rich outer rim occlusion. */}
        <radialGradient cx="37%" cy="30%" id={domeVolumeId} r="68%">
          <stop className="payment-summary__highlight-stop" offset="0%" stopOpacity="0.46" />
          <stop className="payment-summary__highlight-stop" offset="38%" stopOpacity="0.08" />
          <stop className="payment-summary__rim-stop" offset="74%" stopOpacity="0.06" />
          <stop className="payment-summary__rim-stop" offset="100%" stopOpacity="0.44" />
        </radialGradient>
        {/* Bottom-right translucent subsurface bounce matching the jade beads beside it. */}
        <radialGradient cx="65%" cy="84%" id={bounceId} r="48%">
          <stop className="payment-summary__bounce-stop" offset="0%" stopOpacity="0.48" />
          <stop className="payment-summary__bounce-stop" offset="60%" stopOpacity="0.12" />
          <stop className="payment-summary__bounce-stop" offset="100%" stopOpacity="0" />
        </radialGradient>
        {/* Crisp upper-left pearl-jade specular catchlight. */}
        <radialGradient cx="50%" cy="50%" id={catchlightId} r="50%">
          <stop className="payment-summary__highlight-stop" offset="0%" stopOpacity="0.88" />
          <stop className="payment-summary__highlight-stop" offset="56%" stopOpacity="0.24" />
          <stop className="payment-summary__highlight-stop" offset="100%" stopOpacity="0" />
        </radialGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={rimId} x1="2" x2="23" y1="12" y2="2">
          <stop className="payment-summary__highlight-stop" offset="0%" stopOpacity="0" />
          <stop className="payment-summary__highlight-stop" offset="50%" stopOpacity="0.68" />
          <stop className="payment-summary__highlight-stop" offset="100%" stopOpacity="0" />
        </linearGradient>
      </defs>
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
      {total > 0 ? (
        <>
          <path
            aria-hidden="true"
            className="payment-summary__glaze"
            d="M16 0 A16 16 0 1 1 16 32 A16 16 0 1 1 16 0 Z"
            fill={`url(#${domeVolumeId})`}
          />
          <path
            aria-hidden="true"
            className="payment-summary__glaze"
            d="M16 0 A16 16 0 1 1 16 32 A16 16 0 1 1 16 0 Z"
            fill={`url(#${bounceId})`}
          />
          <ellipse
            aria-hidden="true"
            className="payment-summary__glaze"
            cx="10.8"
            cy="8.1"
            fill={`url(#${catchlightId})`}
            rx="4.6"
            ry="2.5"
            transform="rotate(-28 10.8 8.1)"
          />
          <path
            aria-hidden="true"
            className="payment-summary__glaze"
            d="M1.41 12.09 A15.1 15.1 0 0 1 22.38 2.31"
            fill="none"
            stroke={`url(#${rimId})`}
            strokeLinecap="round"
            strokeWidth="1.1"
          />
        </>
      ) : null}
    </svg>
  )
}

/** The workbench's only data: how much has been collected and how much is still due. */
export default function PaymentSummary({
  onRetry,
  onScopeChange,
  paid,
  pending,
  overpaid = 0,
  refreshing = false,
  scope = 'all',
  status,
}: PaymentSummaryProps) {
  const privacyMode = usePrivacyMode()
  const showAmount = (value: number) => maskAmount(formatAmount(value), privacyMode)
  const loading = status === 'loading'
  const empty = status === 'data' && paid === 0 && pending === 0
  const nextScope =
    PAYMENT_SUMMARY_SCOPES[
      (PAYMENT_SUMMARY_SCOPES.indexOf(scope) + 1) % PAYMENT_SUMMARY_SCOPES.length
    ]
  const scopeHint = `${contractScopes[scope]}，点击切换到${contractScopes[nextScope]}`
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
        <Tooltip className="payment-summary__scope-tooltip" content={scopeHint}>
          <Button
            aria-label={`合同范围：${scopeHint}`}
            className="payment-summary__switch"
            onClick={() => onScopeChange(nextScope)}
            variant="bare"
          >
            {pie}
          </Button>
        </Tooltip>
      ) : (
        pie
      )}
      <div className="payment-summary__content">
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
          <div className="payment-summary__message">暂无合同数据</div>
        ) : (
          <dl aria-live="polite" className="payment-summary__legend">
            <div className="payment-summary__row">
              <span aria-hidden="true" className="payment-summary__dot" data-part="paid" />
              <dt className="payment-summary__label">{scopePrefixes[scope]}合同已收</dt>
              <dd className="payment-summary__amount">
                {loading ? (
                  <Skeleton
                    className="payment-summary__amount-placeholder"
                    height="1.2em"
                    width="5.5rem"
                  />
                ) : (
                  showAmount(paid)
                )}
              </dd>
            </div>
            <div className="payment-summary__row">
              <span aria-hidden="true" className="payment-summary__dot" data-part="pending" />
              <dt className="payment-summary__label">{scopePrefixes[scope]}合同未收</dt>
              <dd className="payment-summary__amount">
                {loading ? (
                  <Skeleton
                    className="payment-summary__amount-placeholder"
                    height="1.2em"
                    width="5.5rem"
                  />
                ) : (
                  showAmount(pending)
                )}
              </dd>
            </div>
          </dl>
        )}
        {status === 'data' && overpaid > 0 ? (
          <span className="payment-summary__overpaid">超收 {showAmount(overpaid)}</span>
        ) : null}
      </div>
      {refreshing && !loading ? <Skeleton className="payment-summary__refresh-skeleton" /> : null}
    </Surface>
  )
}
