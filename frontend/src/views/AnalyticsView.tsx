import dayjs from 'dayjs'
import type { ChartConfiguration, Plugin, ScriptableContext } from 'chart.js'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  dashboardApi,
  type DashboardScope,
  type DashboardStats,
  type IncomeTrend,
} from '@/api/dashboard'
import Chart from '@/config/chart'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import {
  Button,
  EmptyScene,
  EmptyState,
  JadeIcon,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Tabs,
} from '@/design-system'
import { useToastStore } from '@/composables/useToast'
import { useThemeStore } from '@/stores/theme'
import { exportCsv } from '@/utils/csv'
import { getCollectionTimingLabel, getPeriodLabel } from '@/views/dashboard/dashboardModel'
import { formatAmount, formatCurrency } from '@/utils/format'
import '@/styles/analytics.css'

// Four rolling windows, then a calendar year or month of the user's choosing.
type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom'

const periods: Period[] = ['week', 'month', 'quarter', 'year', 'custom']

interface CalendarChoice {
  /** 1–12, or 0 for the whole year. */
  month: number
  year: number
}

const thisYear = new Date().getFullYear()
// Plans reach into next year; history goes back as far as anyone is likely to look.
const yearOptions = Array.from({ length: 12 }, (_, index) => {
  const year = thisYear + 1 - index
  return { label: `${year}年`, value: String(year) }
})
const monthOptions = [
  { label: '全年', value: '0' },
  ...Array.from({ length: 12 }, (_, index) => ({
    label: `${index + 1}月`,
    value: String(index + 1),
  })),
]

const calendarName = ({ month, year }: CalendarChoice) =>
  month ? `${year}年${month}月` : `${year}年`

const calendarRange = ({ month, year }: CalendarChoice) => {
  const start = dayjs(new Date(year, month ? month - 1 : 0, 1))
  return [start, start.endOf(month ? 'month' : 'year')].map((date) => date.format('YYYY-MM-DD'))
}

const emptyStats: DashboardStats = {
  avg_collection_days: 0,
  avg_collection_days_trend: 0,
  overdue_amount: 0,
  overdue_trend: 0,
  paid_amount: 0,
  planned_received_amount: 0,
  paid_trend: 0,
  pending_amount: 0,
  pending_trend: 0,
  total_amount: 0,
  total_trend: 0,
}

const emptyTrend: IncomeTrend = {
  actual_values: [],
  expected_values: [],
  labels: [],
}

const periodLabel = (period: Period) => {
  if (period === 'week') return '周'
  if (period === 'month') return '月'
  if (period === 'quarter') return '季'
  if (period === 'year') return '年'
  return '自选'
}

const formatAxisAmount = (amount: number) => {
  if (Math.abs(amount) >= 100000000) return `${Number((amount / 100000000).toFixed(1))}亿`
  if (Math.abs(amount) >= 10000) return `${Number((amount / 10000).toFixed(1))}万`
  return Math.round(amount).toLocaleString('zh-CN')
}

// One decimal at most, and none when it would be a zero: 60%, 66.7%.
const formatShare = (part: number, whole: number) =>
  whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—'

// The API sends `MM-DD` for daily points and `YYYY-MM` for monthly ones.
const formatTrendLabel = (label: string) => {
  const day = /^(\d{2})-(\d{2})$/.exec(label)
  if (day) return `${Number(day[1])}月${Number(day[2])}日`
  const month = /^(\d{4})-(\d{2})$/.exec(label)
  if (month) return `${month[1]}年${Number(month[2])}月`
  return label
}

const readToken = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// Centre-line radius of a ring that touches the edge of a 100-unit box (stroke 22.8, hole 54 %).
const DONUT_RADIUS = 38.6
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

/** Two convex translucent jade-bangle ring segments, clockwise from twelve o'clock: received, then pending. */
function StructureDonut({ paid, pending }: { paid: number; pending: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const total = paid + pending
  const paidShare = total > 0 ? paid / total : 0
  const paidPercent = Math.round(paidShare * 100)
  const paidGradId = `donut-paid-${uid}`
  const pendingGradId = `donut-pending-${uid}`
  const torusGradId = `donut-torus-${uid}`
  const crestGradId = `donut-crest-${uid}`
  const outerRimGradId = `donut-outer-rim-${uid}`
  const bounceGradId = `donut-bounce-${uid}`
  const innerRimGradId = `donut-inner-rim-${uid}`

  return (
    <svg
      aria-label={`已收款 ${paidPercent}%，待收款 ${100 - paidPercent}%`}
      className="analytics-donut"
      role="img"
      viewBox="0 0 100 100"
    >
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={paidGradId}
          x1="14"
          x2="86"
          y1="12"
          y2="88"
        >
          <stop className="analytics-donut__stop--paid-light" offset="0%" />
          <stop className="analytics-donut__stop--paid-base" offset="52%" />
          <stop className="analytics-donut__stop--paid-depth" offset="100%" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={pendingGradId}
          x1="14"
          x2="86"
          y1="12"
          y2="88"
        >
          <stop className="analytics-donut__stop--pending-light" offset="0%" />
          <stop className="analytics-donut__stop--pending-base" offset="100%" />
        </linearGradient>
        {/* Off-center radial 3D torus profile: hydrated translucent jade without uniform milky banding. */}
        <radialGradient cx="47.5" cy="46.5" gradientUnits="userSpaceOnUse" id={torusGradId} r="50">
          <stop className="analytics-donut__stop--shadow" offset="53%" stopOpacity="0.24" />
          <stop className="analytics-donut__stop--shadow" offset="63%" stopOpacity="0.03" />
          <stop className="analytics-donut__stop--crest" offset="74.5%" stopOpacity="0.28" />
          <stop className="analytics-donut__stop--crest" offset="84%" stopOpacity="0.02" />
          <stop className="analytics-donut__stop--shadow" offset="94%" stopOpacity="0.14" />
          <stop className="analytics-donut__stop--shadow" offset="100%" stopOpacity="0.28" />
        </radialGradient>
        {/* Primary directional specular highlight curving along the upper-left raised jade ridge. */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={crestGradId}
          x1="16"
          x2="68"
          y1="34"
          y2="17"
        >
          <stop className="analytics-donut__stop--crest" offset="0%" stopOpacity="0" />
          <stop className="analytics-donut__stop--crest" offset="44%" stopOpacity="0.64" />
          <stop className="analytics-donut__stop--crest" offset="100%" stopOpacity="0" />
        </linearGradient>
        {/* Delicate upper-left crystalline glass rim along the outer bangle contour. */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={outerRimGradId}
          x1="3.4"
          x2="68.4"
          y1="34.9"
          y2="4.6"
        >
          <stop className="analytics-donut__stop--crest" offset="0%" stopOpacity="0" />
          <stop className="analytics-donut__stop--crest" offset="48%" stopOpacity="0.54" />
          <stop className="analytics-donut__stop--crest" offset="100%" stopOpacity="0" />
        </linearGradient>
        {/* Broad, soft subsurface warmth glowing from within the lower-right belly (no double white band). */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={bounceGradId}
          x1="87"
          x2="40"
          y1="63"
          y2="88"
        >
          <stop className="analytics-donut__stop--bounce" offset="0%" stopOpacity="0" />
          <stop className="analytics-donut__stop--bounce" offset="50%" stopOpacity="0.22" />
          <stop className="analytics-donut__stop--bounce" offset="100%" stopOpacity="0" />
        </linearGradient>
        {/* Fine catchlight on the lower-right inner hole wall facing the upper-left light. */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={innerRimGradId}
          x1="77"
          x2="43"
          y1="57"
          y2="77"
        >
          <stop className="analytics-donut__stop--crest" offset="0%" stopOpacity="0" />
          <stop className="analytics-donut__stop--crest" offset="50%" stopOpacity="0.34" />
          <stop className="analytics-donut__stop--crest" offset="100%" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        data-part="pending"
        r={DONUT_RADIUS}
        stroke={`url(#${pendingGradId})`}
      />
      {paidShare > 0 ? (
        <circle
          cx="50"
          cy="50"
          data-part="paid"
          r={DONUT_RADIUS}
          stroke={`url(#${paidGradId})`}
          strokeDasharray={`${(paidShare * DONUT_CIRCUMFERENCE).toFixed(3)} ${DONUT_CIRCUMFERENCE.toFixed(3)}`}
          transform="rotate(-90 50 50)"
        />
      ) : null}
      {/* Exact two-semicircle ring path coincident with the data circles for 3D convex bangle shading (keeps only 2 data circles). */}
      <path
        aria-hidden="true"
        className="analytics-donut__torus"
        d="M50 11.4 A38.6 38.6 0 1 1 50 88.6 A38.6 38.6 0 1 1 50 11.4 Z"
        fill="none"
        stroke={`url(#${torusGradId})`}
      />
      <path
        aria-hidden="true"
        className="analytics-donut__bounce"
        d="M86.84 63.41 A39.2 39.2 0 0 1 39.85 87.86"
        fill="none"
        stroke={`url(#${bounceGradId})`}
      />
      <path
        aria-hidden="true"
        className="analytics-donut__crest"
        d="M16.1 34.2 A37.4 37.4 0 0 1 67.6 17.0"
        fill="none"
        stroke={`url(#${crestGradId})`}
      />
      <path
        aria-hidden="true"
        className="analytics-donut__outer-rim"
        d="M3.4 34.86 A49 49 0 0 1 68.36 4.57"
        fill="none"
        stroke={`url(#${outerRimGradId})`}
      />
      <path
        aria-hidden="true"
        className="analytics-donut__inner-rim"
        d="M77.43 57.35 A28.4 28.4 0 0 1 42.65 77.43"
        fill="none"
        stroke={`url(#${innerRimGradId})`}
      />
    </svg>
  )
}

export default function AnalyticsView() {
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme)
  const reducedMotion = useReducedMotion()
  const [activePeriod, setActivePeriod] = useState<Period>('month')
  const [calendar, setCalendar] = useState<CalendarChoice>({ month: 0, year: thisYear })
  const [exporting, setExporting] = useState(false)
  const [savedExportKey, setSavedExportKey] = useState(0)
  const scope = useMemo<DashboardScope>(
    () => (activePeriod === 'custom' ? calendar : activePeriod),
    [activePeriod, calendar],
  )
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [trend, setTrend] = useState<IncomeTrend>(emptyTrend)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const trendCanvas = useRef<HTMLCanvasElement | null>(null)
  const trendChart = useRef<Chart<'line'> | null>(null)
  const isMountedRef = useRef(false)
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      requestGenerationRef.current += 1
    }
  }, [])

  // The rate and structure follow the same planned cohort, including receipts outside this period.
  // Actual cash receipts remain in paid_amount and in the trend's actual_values.
  const pendingAmount = Math.max(0, stats.pending_amount)
  const overdueAmount = Math.max(0, stats.overdue_amount)
  const plannedReceivedAmount = Math.max(0, stats.planned_received_amount)

  const hasTrendData = useMemo(
    () =>
      trend.actual_values.some((value) => value !== 0) ||
      trend.expected_values.some((value) => value !== 0),
    [trend.actual_values, trend.expected_values],
  )

  const hasStructureData = plannedReceivedAmount + pendingAmount > 0

  const periodName =
    activePeriod === 'custom' ? calendarName(calendar) : getPeriodLabel(activePeriod)
  const [fallbackStart, fallbackEnd] =
    activePeriod === 'custom'
      ? calendarRange(calendar)
      : [
          dayjs()
            .subtract({ week: 7, month: 30, quarter: 90, year: 365 }[activePeriod] - 1, 'day')
            .format('YYYY-MM-DD'),
          dayjs().format('YYYY-MM-DD'),
        ]
  const rangeLabel = `${(!isLoading && !loadError && trend.start_date) || fallbackStart} — ${
    (!isLoading && !loadError && trend.end_date) || fallbackEnd
  }`

  const colors = useMemo(() => {
    const isDark = effectiveTheme === 'dark'
    return {
      actual: readToken('--ods-data-series-actual', isDark ? '#85bc8b' : '#629569'),
      actualFill: readToken(
        '--ods-data-series-actual-fill',
        isDark ? 'rgba(133, 188, 139, 0.2)' : 'rgba(98, 149, 105, 0.2)',
      ),
      actualFillMid: isDark ? 'rgba(133, 188, 139, 0.07)' : 'rgba(98, 149, 105, 0.07)',
      actualGlow: isDark ? 'rgba(133, 188, 139, 0.28)' : 'rgba(75, 127, 88, 0.22)',
      actualLight: readToken('--ods-material-jade-icon-edge', isDark ? '#c8e9d1' : '#538a6d'),
      axis: readToken('--ods-color-border-strong', isDark ? '#799588' : '#a9bfb0'),
      crosshair: isDark ? 'rgba(160, 215, 175, 0.26)' : 'rgba(45, 101, 74, 0.2)',
      grid: readToken(
        '--ods-data-grid',
        isDark ? 'rgba(229, 242, 233, 0.1)' : 'rgba(24, 57, 44, 0.1)',
      ),
      planned: readToken('--ods-data-series-planned', isDark ? '#e3c574' : '#8d6c29'),
      pointBg: readToken('--ods-data-point-bg', isDark ? '#22362f' : '#f6fbf6'),
      text: readToken('--ods-color-fg-muted', isDark ? '#adc2b6' : '#4f655a'),
      tooltipBackground: readToken('--ods-data-tooltip-bg', isDark ? '#22362f' : '#f6fbf6'),
      tooltipBorder: readToken('--ods-data-tooltip-border', isDark ? '#3d564b' : '#cedcd1'),
      tooltipText: readToken('--ods-data-tooltip-fg', isDark ? '#e5f2e9' : '#10321a'),
    }
  }, [effectiveTheme])

  const initCharts = useCallback(() => {
    trendChart.current?.destroy()

    const context = trendCanvas.current?.getContext('2d')
    if (!context) return

    // Layered translucent jade mist under the actual receipt curve.
    const areaFill = ({ chart }: ScriptableContext<'line'>) => {
      const area = chart.chartArea
      if (!area || typeof chart.ctx?.createLinearGradient !== 'function') return colors.actualFill
      const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
      gradient.addColorStop(0, colors.actualFill)
      gradient.addColorStop(0.58, colors.actualFillMid)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      return gradient
    }

    // Gentle luminous jade gradient along the primary curve.
    const actualStroke = ({ chart }: ScriptableContext<'line'>) => {
      const area = chart.chartArea
      if (!area || typeof chart.ctx?.createLinearGradient !== 'function') return colors.actual
      const gradient = chart.ctx.createLinearGradient(area.left, area.top, area.right, area.bottom)
      gradient.addColorStop(0, colors.actualLight)
      gradient.addColorStop(0.55, colors.actual)
      gradient.addColorStop(1, colors.actual)
      return gradient
    }

    const jadeChartPlugin: Plugin<'line'> = {
      id: 'odsJadeChartFinish',
      beforeDatasetsDraw(chart) {
        const active = chart.tooltip?.getActiveElements?.()
        if (!active?.length) return
        const { chartArea, ctx } = chart
        if (!chartArea || typeof ctx?.save !== 'function') return
        const x = active[0].element.x
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 1
        ctx.strokeStyle = colors.crosshair
        ctx.moveTo(x, chartArea.top)
        ctx.lineTo(x, chartArea.bottom)
        ctx.stroke()
        ctx.restore()
      },
      beforeDatasetDraw(chart, args) {
        if (args.index !== 0 || typeof chart.ctx?.save !== 'function') return
        chart.ctx.save()
        chart.ctx.shadowColor = colors.actualGlow
        chart.ctx.shadowBlur = 10
        chart.ctx.shadowOffsetY = 4
      },
      afterDatasetDraw(chart, args) {
        if (args.index !== 0 || typeof chart.ctx?.restore !== 'function') return
        chart.ctx.restore()
      },
    }

    const config: ChartConfiguration<'line'> = {
      data: {
        datasets: [
          {
            backgroundColor: areaFill,
            borderColor: actualStroke,
            borderWidth: 3,
            data: [],
            fill: 'origin',
            label: '实际收款',
            pointHoverBackgroundColor: colors.pointBg,
            pointHoverBorderColor: colors.actual,
            pointHoverBorderWidth: 2.5,
            pointStyle: 'circle',
            tension: 0.34,
          },
          {
            borderColor: colors.planned,
            borderDash: [8, 5],
            borderWidth: 2.5,
            data: [],
            fill: false,
            label: '计划收款',
            pointHoverBackgroundColor: colors.pointBg,
            pointHoverBorderColor: colors.planned,
            pointHoverBorderWidth: 2.5,
            pointStyle: 'circle',
            tension: 0.34,
          },
        ],
        labels: [],
      },
      options: {
        animation: { duration: reducedMotion ? 0 : 280, easing: 'easeOutCubic' },
        elements: {
          line: {
            borderCapStyle: 'round',
            borderJoinStyle: 'round',
            cubicInterpolationMode: 'monotone',
          },
          point: { hitRadius: 14, hoverRadius: 6.5, radius: 0 },
        },
        interaction: { intersect: false, mode: 'index' },
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBackground,
            bodyColor: colors.tooltipText,
            bodySpacing: 5,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            boxPadding: 6,
            callbacks: {
              label: (item) =>
                `${item.dataset.label ?? '金额'}：${formatCurrency(Number(item.raw))}`,
            },
            cornerRadius: 14,
            padding: { bottom: 10, left: 14, right: 14, top: 10 },
            titleColor: colors.tooltipText,
            titleMarginBottom: 6,
            usePointStyle: true,
          },
        },
        responsive: true,
        scales: {
          x: {
            border: { color: colors.axis },
            grid: { color: colors.axis, drawOnChartArea: false, tickLength: 6 },
            ticks: { color: colors.text, maxRotation: 0, maxTicksLimit: 6 },
          },
          y: {
            beginAtZero: true,
            border: { color: colors.axis },
            grid: { color: colors.grid, drawTicks: false },
            ticks: {
              callback: (value) => formatAxisAmount(Number(value) || 0),
              color: colors.text,
              maxTicksLimit: 6,
              padding: 12,
            },
          },
        },
      },
      plugins: [jadeChartPlugin],
      type: 'line',
    }
    trendChart.current = new Chart(context, config)
  }, [colors, reducedMotion])

  const fetchAnalytics = useCallback(
    async (target: DashboardScope, signal?: AbortSignal) => {
      const requestGeneration = ++requestGenerationRef.current
      setIsLoading(true)
      setLoadError(false)

      try {
        const [statsResponse, trendResponse] = await Promise.all([
          dashboardApi.getStats(target, signal),
          dashboardApi.getIncomeTrend(target, signal),
        ])
        if (
          signal?.aborted ||
          !isMountedRef.current ||
          requestGeneration !== requestGenerationRef.current
        ) {
          return
        }
        setStats(statsResponse.data.data)
        setTrend(trendResponse.data.data)
      } catch {
        if (
          signal?.aborted ||
          !isMountedRef.current ||
          requestGeneration !== requestGenerationRef.current
        ) {
          return
        }
        setLoadError(true)
        toastError('获取分析数据失败')
      } finally {
        if (
          !signal?.aborted &&
          isMountedRef.current &&
          requestGeneration === requestGenerationRef.current
        ) {
          setIsLoading(false)
        }
      }
    },
    [toastError],
  )

  useEffect(() => {
    if (isLoading || loadError) {
      trendChart.current?.destroy()
      trendChart.current = null
      return
    }

    initCharts()
    return () => {
      trendChart.current?.destroy()
      trendChart.current = null
    }
  }, [initCharts, isLoading, loadError])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchAnalytics(scope, controller.signal)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
      requestGenerationRef.current += 1
    }
  }, [fetchAnalytics, scope])

  useEffect(() => {
    const chart = trendChart.current
    if (!chart) return
    chart.data.labels = trend.labels.map(formatTrendLabel)
    if (chart.data.datasets[0]) chart.data.datasets[0].data = trend.actual_values
    if (chart.data.datasets[1]) chart.data.datasets[1].data = trend.expected_values
    if (reducedMotion) chart.update('none')
    else chart.update()
  }, [colors, reducedMotion, trend])

  const metrics = [
    { label: '平均到账偏差', value: getCollectionTimingLabel(stats.avg_collection_days) },
    { label: '预期收款', value: formatAmount(stats.total_amount) },
    { label: '收款率', value: formatShare(stats.planned_received_amount, stats.total_amount) },
    { label: '逾期比例', value: formatShare(stats.overdue_amount, stats.total_amount) },
  ]

  const handlePeriodChange = (value: string) => {
    const period = periods.find((candidate) => candidate === value)
    if (!period || period === activePeriod) return
    setIsLoading(true)
    setLoadError(false)
    setActivePeriod(period)
  }

  const chooseCalendar = (change: Partial<CalendarChoice>) => {
    setIsLoading(true)
    setLoadError(false)
    setCalendar((current) => ({ ...current, ...change }))
  }

  const retryAction = (
    <Button onClick={() => void fetchAnalytics(scope)} size="sm" variant="secondary">
      重新加载
    </Button>
  )

  const handleExport = useCallback(async () => {
    const rows: Array<Array<number | string>> = [
      ['珠算 数据分析'],
      ['统计周期', periodName],
      ['日期范围', rangeLabel],
      ['平均到账偏差（天，提前为负）', stats.avg_collection_days],
      ['应收金额', stats.total_amount],
      ['本期计划已收金额', stats.planned_received_amount],
      ['本期实际到账金额', stats.paid_amount],
      ['待收未逾期金额', Math.max(0, stats.pending_amount - stats.overdue_amount)],
      ['逾期金额', stats.overdue_amount],
      ['收款率', formatShare(stats.planned_received_amount, stats.total_amount)],
      ['逾期比例', formatShare(stats.overdue_amount, stats.total_amount)],
      [],
      ['趋势周期', '实际收款', '预期收款'],
      ...trend.labels.map((label, index) => [
        label,
        trend.actual_values[index] ?? '',
        trend.expected_values[index] ?? '',
      ]),
    ]
    setExporting(true)
    try {
      const result = await exportCsv(`珠算-数据分析-${periodName}.csv`, rows)
      if (result.status === 'saved') {
        toastSuccess('报表已导出')
        if (isMountedRef.current) setSavedExportKey((key) => key + 1)
      }
    } catch {
      toastError('导出失败，请重试')
    } finally {
      if (isMountedRef.current) setExporting(false)
    }
  }, [periodName, rangeLabel, stats, toastError, toastSuccess, trend])

  return (
    <Tabs.Root
      className="analytics-view"
      data-motion-scope="analytics"
      onValueChange={handlePeriodChange}
      value={activePeriod}
    >
      <PageHeader
        actions={
          <div className="analytics-page-toolbar">
            <Tabs.List aria-label="统计周期" variant="accent">
              {periods.map((period) => (
                <Tabs.Tab className="analytics-period-tab" key={period} value={period}>
                  {periodLabel(period)}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {activePeriod === 'custom' ? (
              <div className="analytics-calendar">
                <Select
                  aria-label="统计年份"
                  clearable={false}
                  onValueChange={(value) => chooseCalendar({ year: Number(value) })}
                  options={yearOptions}
                  value={String(calendar.year)}
                  width="content"
                />
                <Select
                  aria-label="统计月份"
                  clearable={false}
                  onValueChange={(value) => chooseCalendar({ month: Number(value) })}
                  options={monthOptions}
                  value={String(calendar.month)}
                  width="content"
                />
              </div>
            ) : null}
            <Button
              className="analytics-export-button"
              disabled={isLoading || loadError}
              onClick={() => void handleExport()}
              pending={exporting}
              variant="outline"
            >
              <JadeIcon
                motionPreset="interactive"
                name="download"
                reaction={
                  savedExportKey > 0 ? { eventKey: savedExportKey, kind: 'saved' } : undefined
                }
                size="1em"
              />
              <span>导出报表</span>
            </Button>
          </div>
        }
        data-motion="entrance"
        title="数据分析"
      />

      {periods.map((period) => (
        <Tabs.Panel className="analytics-period-panel" key={period} value={period}>
          {activePeriod === period ? (
            <>
              <dl
                aria-busy={isLoading}
                aria-label="关键指标"
                className="analytics-metrics"
                data-motion="entrance"
              >
                {metrics.map((metric) => (
                  <div className="analytics-metric" key={metric.label}>
                    <dt className="analytics-metric__label">{metric.label}</dt>
                    <dd className="analytics-metric__value">
                      {isLoading ? (
                        <Skeleton height="1.75rem" width="6rem" />
                      ) : loadError ? (
                        '暂不可用'
                      ) : (
                        metric.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="analytics-chart-layout" data-motion="entrance">
                <section aria-labelledby="analytics-trend-title" className="analytics-chart">
                  <header className="analytics-chart__header">
                    <h2 className="analytics-chart__title" id="analytics-trend-title">
                      收款趋势
                    </h2>
                    <ul aria-label="图例" className="analytics-legend">
                      <li className="analytics-legend__item" data-series="actual">
                        实际收款
                      </li>
                      <li className="analytics-legend__item" data-series="planned">
                        计划收款
                      </li>
                    </ul>
                  </header>
                  <div className="analytics-chart__body">
                    {isLoading ? (
                      <div
                        aria-label="收款趋势加载中"
                        className="analytics-chart-state"
                        role="status"
                      >
                        <Skeleton height="100%" width="100%" />
                      </div>
                    ) : loadError ? (
                      <EmptyState
                        action={retryAction}
                        className="analytics-chart-empty"
                        description="请检查连接后重新加载"
                        icon={<JadeIcon name="warning" size="1em" />}
                        size="sm"
                        title="趋势数据暂不可用"
                      />
                    ) : !hasTrendData ? (
                      <EmptyState
                        className="analytics-chart-empty"
                        scene={<EmptyScene name="trend-empty" size="compact" />}
                        size="sm"
                        title="本期暂无回款趋势"
                      />
                    ) : (
                      <>
                        <div className="analytics-chart__canvas">
                          <canvas aria-hidden="true" ref={trendCanvas} />
                        </div>
                        <Table.Root visuallyHidden>
                          <caption>{periodName}收款趋势数据</caption>
                          <Table.Header>
                            <Table.Row>
                              <Table.Column>周期</Table.Column>
                              <Table.Column>实际收款</Table.Column>
                              <Table.Column>计划收款</Table.Column>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {trend.labels.map((label, index) => (
                              <Table.Row key={`${label}-${index}`}>
                                <Table.Column scope="row">{formatTrendLabel(label)}</Table.Column>
                                <Table.Cell>
                                  {trend.actual_values[index] == null
                                    ? '暂无数据'
                                    : formatCurrency(trend.actual_values[index] ?? 0)}
                                </Table.Cell>
                                <Table.Cell>
                                  {trend.expected_values[index] == null
                                    ? '暂无数据'
                                    : formatCurrency(trend.expected_values[index] ?? 0)}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      </>
                    )}
                  </div>
                </section>

                <section
                  aria-labelledby="analytics-structure-title"
                  className="analytics-chart analytics-chart--structure"
                >
                  <header className="analytics-chart__header">
                    <h2 className="analytics-chart__title" id="analytics-structure-title">
                      收款结构
                    </h2>
                  </header>
                  <div className="analytics-chart__body">
                    {isLoading ? (
                      <div
                        aria-label="收款结构加载中"
                        className="analytics-chart-state analytics-structure"
                        role="status"
                      >
                        <Skeleton className="analytics-loading-donut" shape="ring" />
                        <div className="analytics-loading-legend">
                          {[0, 1].map((row) => (
                            <div className="analytics-loading-legend-row" key={row}>
                              <Skeleton height="0.875rem" shape="circle" width="0.875rem" />
                              <Skeleton height="1rem" width="4rem" />
                              <Skeleton height="1rem" width="5rem" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : loadError ? (
                      <EmptyState
                        action={retryAction}
                        className="analytics-chart-empty"
                        description="请检查连接后重新加载"
                        icon={<JadeIcon name="warning" size="1em" />}
                        size="sm"
                        title="收款结构暂不可用"
                      />
                    ) : !hasStructureData ? (
                      <EmptyState
                        className="analytics-chart-empty"
                        scene={<EmptyScene name="structure-empty" size="compact" />}
                        size="sm"
                        title="本期暂无收款结构"
                      />
                    ) : (
                      <div className="analytics-structure">
                        <StructureDonut paid={plannedReceivedAmount} pending={pendingAmount} />
                        <dl className="analytics-structure__legend">
                          <div className="analytics-structure__row" data-part="paid">
                            <dt>已收款</dt>
                            <dd>{formatAmount(stats.planned_received_amount)}</dd>
                          </div>
                          <div className="analytics-structure__row" data-part="pending">
                            <dt>待收款</dt>
                            <dd>{formatAmount(stats.pending_amount)}</dd>
                            {overdueAmount > 0 ? (
                              <dd className="analytics-structure__note">
                                其中逾期 {formatAmount(overdueAmount)}
                              </dd>
                            ) : null}
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
