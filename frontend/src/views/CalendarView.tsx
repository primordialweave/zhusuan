import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Payment } from '@/api/project'
import { dashboardApi } from '@/api/dashboard'
import { useToastStore } from '@/composables/useToast'
import {
  Button,
  Calendar,
  EmptyScene,
  EmptyState,
  JadeIcon,
  PageHeader,
  RouterLink,
  Skeleton,
} from '@/design-system'
import { formatAmount } from '@/utils/format'
import { toDateOnly } from '@/utils/dateOnly'
import '@/styles/calendar-domain.css'

const paymentStageLabels: Record<string, string> = {
  receipt: '收款',
  all: '全款',
  deposit: '预付款',
  final: '尾款',
  milestone: '阶段款',
  process: '进度款',
  progress: '进度款',
}

const formatStage = (payment: Payment) =>
  paymentStageLabels[payment.stage] || payment.stage || '收款'

type StatusGroup = 'received'

const GROUP_LABEL: Record<StatusGroup, string> = {
  received: '已收',
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const CELL_LINE_LIMIT = 2
const UPCOMING_LIMIT = 5

interface DaySummary {
  count: number
  groups: Array<{ amount: number; count: number; group: StatusGroup }>
}

const paymentLink = (payment: Payment) =>
  `/projects/${payment.project_id}?tab=payments&payment=${payment.id}`

const byReceiptId = (a: Payment, b: Payment) => a.id - b.id

const summarizeDay = (payments: Payment[]): DaySummary => ({
  count: payments.length,
  groups: [
    {
      amount: payments.reduce((sum, payment) => sum + payment.amount, 0),
      count: payments.length,
      group: 'received',
    },
  ],
})

const formatDayHeading = (date: string) => {
  const day = dayjs(date)
  return `${day.month() + 1}月${day.date()}日 · 周${WEEKDAY_NAMES[day.day()]}`
}

const formatShortDate = (date: string) => {
  const day = dayjs(date)
  return day.isValid() ? `${day.month() + 1}月${day.date()}日` : '—'
}

function DayEntries({ summary }: { summary: DaySummary }) {
  const visible = summary.groups.slice(0, CELL_LINE_LIMIT)
  const hiddenCount = summary.groups
    .slice(CELL_LINE_LIMIT)
    .reduce((sum, entry) => sum + entry.count, 0)

  return (
    <>
      {visible.map((entry) => (
        <span className="calendar-day-entry" data-status={entry.group} key={entry.group}>
          <span aria-hidden="true" className="calendar-day-entry__dot" />
          <span className="calendar-day-entry__text">
            {GROUP_LABEL[entry.group]} {formatAmount(entry.amount)}
          </span>
        </span>
      ))}
      {hiddenCount > 0 ? <span className="calendar-day-entry__more">+{hiddenCount} 笔</span> : null}
    </>
  )
}

function PaymentEntry({ payment }: { payment: Payment }) {
  return (
    <li className="calendar-entry" data-motion-item>
      <div className="calendar-entry__identity">
        <RouterLink className="calendar-entry__name" to={paymentLink(payment)} tone="foreground">
          {payment.project?.name || '未知项目'}
        </RouterLink>
        <span className="calendar-entry__stage">{formatStage(payment)}</span>
      </div>
      <span className="calendar-entry__amount">{formatAmount(payment.amount)}</span>
    </li>
  )
}

export default function CalendarView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const toastError = useToastStore((state) => state.error)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const dateParam = searchParams.get('date') || ''
  const selectedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dayjs(dateParam).format('YYYY-MM-DD') === dateParam
      ? dateParam
      : dayjs().format('YYYY-MM-DD')
  const monthKey = selectedDate.slice(0, 7)
  const currentMonth = useMemo(() => dayjs(`${monthKey}-01`), [monthKey])
  const setSelectedDate = useCallback(
    (value: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('date', value)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const mountedRef = useRef(false)
  const requestIdRef = useRef(0)

  const loadPayments = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setLoadError(false)
    try {
      const response = await dashboardApi.getReceipts(
        currentMonth.startOf('month').format('YYYY-MM-DD'),
        currentMonth.endOf('month').format('YYYY-MM-DD'),
      )
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      setPayments(
        response.data.data.flatMap((payment) => {
          const date = toDateOnly(payment.actual_date)
          return date && (payment.status === 'confirmed' || payment.status === 'paid')
            ? [{ ...payment, actual_date: date }]
            : []
        }),
      )
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      setPayments([])
      setLoadError(true)
      toastError('获取收款日历失败')
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false)
    }
  }, [currentMonth, toastError])

  useEffect(() => {
    mountedRef.current = true
    const timer = window.setTimeout(loadPayments, 0)
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      window.clearTimeout(timer)
    }
  }, [loadPayments])

  const daySummaries = useMemo(() => {
    const byDate = new Map<string, Payment[]>()
    for (const payment of payments) {
      const date = payment.actual_date ?? ''
      if (!date.startsWith(monthKey)) continue
      byDate.set(date, [...(byDate.get(date) ?? []), payment])
    }
    return new Map([...byDate].map(([date, items]) => [date, summarizeDay(items)]))
  }, [monthKey, payments])

  const selectedDatePayments = useMemo(
    () => payments.filter((payment) => payment.actual_date === selectedDate).sort(byReceiptId),
    [payments, selectedDate],
  )

  // Other actual receipts in the visible month, newest first.
  const upcomingPayments = useMemo(() => {
    return payments
      .filter(
        (payment) =>
          payment.actual_date?.startsWith(monthKey) && payment.actual_date !== selectedDate,
      )
      .sort((a, b) => (b.actual_date ?? '').localeCompare(a.actual_date ?? '') || b.id - a.id)
  }, [monthKey, payments, selectedDate])

  const handleVisibleMonthChange = useCallback(
    (value: string) => {
      const nextMonth = dayjs(value).startOf('month')
      if (nextMonth.format('YYYY-MM') === monthKey) return
      setLoading(true)
      setLoadError(false)
      // Keep the day of month where the new month has it.
      const day = Math.min(dayjs(selectedDate).date(), nextMonth.daysInMonth())
      setSelectedDate(nextMonth.date(day).format('YYYY-MM-DD'))
    },
    [monthKey, selectedDate, setSelectedDate],
  )

  const isDateMarked = useCallback((date: string) => daySummaries.has(date), [daySummaries])

  const getDateAriaLabel = useCallback(
    (date: string) => {
      const day = dayjs(date)
      const summary = daySummaries.get(date)
      const base = `${day.year()}年${day.month() + 1}月${day.date()}日，星期${WEEKDAY_NAMES[day.day()]}`
      if (!summary) return base
      return `${base}，${summary.groups
        .map((entry) => `${GROUP_LABEL[entry.group]} ${formatAmount(entry.amount)}`)
        .join('，')}，共 ${summary.count} 笔`
    },
    [daySummaries],
  )

  const renderDayContent = useCallback(
    (date: string) => {
      if (loading && date.startsWith(monthKey)) {
        return <Skeleton className="calendar-day-loading" height="0.45rem" width="72%" />
      }
      const summary = daySummaries.get(date)
      return summary ? <DayEntries summary={summary} /> : null
    },
    [daySummaries, loading, monthKey],
  )

  return (
    <div className="calendar-view" data-motion-scope="calendar">
      <PageHeader title="收款日历" />

      <div className="calendar-view__layout" data-motion="entrance">
        <section aria-label="月历" className="calendar-board">
          <Calendar
            aria-busy={loading}
            getDateAriaLabel={getDateAriaLabel}
            isDateMarked={isDateMarked}
            layout="board"
            onValueChange={setSelectedDate}
            onVisibleMonthChange={handleVisibleMonthChange}
            renderDayContent={renderDayContent}
            showTodayAction
            todayActionLabel="本月"
            value={selectedDate}
            visibleMonth={currentMonth.format('YYYY-MM-DD')}
            weekStartsOn={0}
          />
        </section>

        <aside aria-busy={loading} aria-label="收款明细" className="calendar-detail">
          <div className="calendar-detail__scroll">
            <section className="calendar-detail__section">
              <h2 className="calendar-detail__heading">{formatDayHeading(selectedDate)}</h2>
              {loading ? (
                <div aria-label="正在加载收款记录" className="calendar-loading-list" role="status">
                  {[0, 1].map((row) => (
                    <div className="calendar-loading-entry" key={row}>
                      <div className="calendar-loading-identity">
                        <Skeleton height="1rem" width="75%" />
                        <Skeleton height="0.75rem" width="48%" />
                      </div>
                      <Skeleton height="1rem" width="4rem" />
                    </div>
                  ))}
                </div>
              ) : loadError ? (
                <EmptyState
                  action={
                    <Button onClick={() => void loadPayments()} size="sm" variant="ghost">
                      重试
                    </Button>
                  }
                  icon={<JadeIcon name="wifi-off" size="1em" />}
                  size="sm"
                  title="收款记录暂时不可用"
                />
              ) : selectedDatePayments.length === 0 ? (
                <EmptyState
                  scene={<EmptyScene name="calendar-empty" size="compact" />}
                  size="sm"
                  title="该日无收款"
                />
              ) : (
                <ul className="calendar-entries" key={selectedDate}>
                  {selectedDatePayments.map((payment) => (
                    <PaymentEntry key={payment.id} payment={payment} />
                  ))}
                </ul>
              )}
            </section>

            {loadError ? null : (
              <section className="calendar-detail__section">
                <h2 className="calendar-detail__heading">近期收款</h2>
                {loading ? (
                  <div
                    aria-label="正在加载近期收款"
                    className="calendar-loading-list"
                    role="status"
                  >
                    {[0, 1, 2].map((row) => (
                      <div className="calendar-loading-upcoming" key={row}>
                        <Skeleton height="1rem" width="4rem" />
                        <Skeleton height="1rem" width="72%" />
                      </div>
                    ))}
                  </div>
                ) : upcomingPayments.length === 0 ? (
                  <p className="calendar-detail__empty">本月没有其他收款记录</p>
                ) : (
                  <ul className="calendar-upcoming">
                    {upcomingPayments.slice(0, UPCOMING_LIMIT).map((payment) => (
                      <li className="calendar-upcoming__item" key={payment.id}>
                        <RouterLink
                          className="calendar-upcoming__link"
                          replace
                          to={`?date=${payment.actual_date}`}
                          tone="foreground"
                          underline="none"
                        >
                          <span className="calendar-upcoming__date">
                            {formatShortDate(payment.actual_date ?? '')}
                          </span>
                          <span className="calendar-upcoming__name">
                            {payment.project?.name || '未知项目'}
                          </span>
                        </RouterLink>
                      </li>
                    ))}
                  </ul>
                )}
                {upcomingPayments.length > UPCOMING_LIMIT ? (
                  <p className="calendar-detail__empty">
                    另有 {upcomingPayments.length - UPCOMING_LIMIT} 笔
                  </p>
                ) : null}
              </section>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
