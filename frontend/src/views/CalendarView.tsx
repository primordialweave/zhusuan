import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { paymentApi, type Payment } from '@/api/project'
import { useToastStore } from '@/composables/useToast'
import {
  Button,
  Calendar,
  Chip,
  EmptyState,
  PageHeader,
  RouterLink,
  Skeleton,
  type SurfaceTone,
} from '@/design-system'
import { formatAmount } from '@/utils/format'
import '@/styles/calendar-domain.css'

const paymentStageLabels: Record<string, string> = {
  all: '全款',
  deposit: '预付款',
  final: '尾款',
  milestone: '阶段款',
  process: '进度款',
  progress: '进度款',
}

const formatStage = (payment: Payment) =>
  paymentStageLabels[payment.stage] || payment.stage || '收款'

const statusMeta: Record<Payment['status'], { label: string; tone: SurfaceTone }> = {
  confirmed: { label: '已收', tone: 'success' },
  overdue: { label: '逾期', tone: 'danger' },
  paid: { label: '已收', tone: 'success' },
  pending: { label: '待收', tone: 'warning' },
}

const getPaymentStatus = (payment: Payment): Payment['status'] => {
  const planDate = dayjs(payment.plan_date)
  return payment.status === 'pending' && planDate.isValid() && planDate.isBefore(dayjs(), 'day')
    ? 'overdue'
    : payment.status
}

type PaymentStatus = Payment['status']
type StatusGroup = 'overdue' | 'pending' | 'received'

// Most urgent first: the order of in-cell lines and of a day's entries.
const STATUS_GROUPS: StatusGroup[] = ['overdue', 'pending', 'received']
const GROUP_LABEL: Record<StatusGroup, string> = {
  overdue: '逾期',
  pending: '待收',
  received: '已收',
}
const statusGroup = (status: PaymentStatus): StatusGroup =>
  status === 'overdue' || status === 'pending' ? status : 'received'

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const CELL_LINE_LIMIT = 2
const UPCOMING_LIMIT = 5

interface DaySummary {
  count: number
  groups: Array<{ amount: number; count: number; group: StatusGroup }>
}

const paymentLink = (payment: Payment) =>
  `/projects/${payment.project_id}?tab=payments&payment=${payment.id}`

const byUrgency = (a: Payment, b: Payment) =>
  STATUS_GROUPS.indexOf(statusGroup(getPaymentStatus(a))) -
    STATUS_GROUPS.indexOf(statusGroup(getPaymentStatus(b))) || a.id - b.id

const summarizeDay = (payments: Payment[]): DaySummary => ({
  count: payments.length,
  groups: STATUS_GROUPS.map((group) => {
    const matching = payments.filter((payment) => statusGroup(getPaymentStatus(payment)) === group)
    return {
      amount: matching.reduce((sum, payment) => sum + payment.amount, 0),
      count: matching.length,
      group,
    }
  }).filter((entry) => entry.count > 0),
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
  const status = getPaymentStatus(payment)
  const received = statusGroup(status) === 'received'
  const actualDate = received && payment.actual_date ? payment.actual_date.slice(0, 10) : ''

  return (
    <li className="calendar-entry" data-motion-item>
      <div className="calendar-entry__identity">
        <RouterLink className="calendar-entry__name" to={paymentLink(payment)} tone="foreground">
          {payment.project?.name || '未知项目'}
        </RouterLink>
        <span className="calendar-entry__stage">
          {formatStage(payment)}
          {actualDate && actualDate !== payment.plan_date
            ? ` · ${formatShortDate(actualDate)}到账`
            : ''}
        </span>
      </div>
      <span className="calendar-entry__amount">{formatAmount(payment.amount)}</span>
      <Chip size="lg" tone={statusMeta[status].tone}>
        {statusMeta[status].label}
      </Chip>
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
      const response = await paymentApi.list({
        _t: Date.now(),
        end_date: currentMonth.endOf('month').format('YYYY-MM-DD'),
        start_date: currentMonth.startOf('month').format('YYYY-MM-DD'),
      })
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      setPayments(
        response.data.data.map((payment) => ({
          ...payment,
          // Go serializes this date-only field as a timestamp; keep its calendar day in any timezone.
          plan_date: payment.plan_date.slice(0, 10),
        })),
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
      if (!payment.plan_date.startsWith(monthKey)) continue
      byDate.set(payment.plan_date, [...(byDate.get(payment.plan_date) ?? []), payment])
    }
    return new Map([...byDate].map(([date, items]) => [date, summarizeDay(items)]))
  }, [monthKey, payments])

  const selectedDatePayments = useMemo(
    () => payments.filter((payment) => payment.plan_date === selectedDate).sort(byUrgency),
    [payments, selectedDate],
  )

  // Pending plans from today on, within the visible month; the selected day is already listed above.
  const upcomingPayments = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return payments
      .filter(
        (payment) =>
          payment.status === 'pending' &&
          payment.plan_date.startsWith(monthKey) &&
          payment.plan_date >= today &&
          payment.plan_date !== selectedDate,
      )
      .sort((a, b) => a.plan_date.localeCompare(b.plan_date) || a.id - b.id)
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
      const summary = daySummaries.get(date)
      return summary ? <DayEntries summary={summary} /> : null
    },
    [daySummaries],
  )

  return (
    <div className="calendar-view" data-motion-scope="calendar">
      <PageHeader description="查看计划收款与到账安排" title="收款日历" />

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
                <div aria-label="正在加载收款计划" className="calendar-loading-list" role="status">
                  <Skeleton height="3.75rem" />
                  <Skeleton height="3.75rem" />
                </div>
              ) : loadError ? (
                <EmptyState
                  action={
                    <Button onClick={() => void loadPayments()} size="sm" variant="ghost">
                      重试
                    </Button>
                  }
                  icon={<i className="ri-wifi-off-line" />}
                  size="sm"
                  title="收款计划暂时不可用"
                />
              ) : selectedDatePayments.length === 0 ? (
                <EmptyState
                  icon={<i className="ri-calendar-check-line" />}
                  size="sm"
                  title="该日无收款计划"
                />
              ) : (
                <ul className="calendar-entries" key={selectedDate}>
                  {selectedDatePayments.map((payment) => (
                    <PaymentEntry key={payment.id} payment={payment} />
                  ))}
                </ul>
              )}
            </section>

            {loading || loadError ? null : (
              <section className="calendar-detail__section">
                <h2 className="calendar-detail__heading">近期收款</h2>
                {upcomingPayments.length === 0 ? (
                  <p className="calendar-detail__empty">本月没有其他待收款项</p>
                ) : (
                  <ul className="calendar-upcoming">
                    {upcomingPayments.slice(0, UPCOMING_LIMIT).map((payment) => (
                      <li className="calendar-upcoming__item" key={payment.id}>
                        <RouterLink
                          className="calendar-upcoming__link"
                          replace
                          to={`?date=${payment.plan_date}`}
                          tone="foreground"
                          underline="none"
                        >
                          <span className="calendar-upcoming__date">
                            {formatShortDate(payment.plan_date)}
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
