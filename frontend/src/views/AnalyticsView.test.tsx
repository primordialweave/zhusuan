import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardApi, type DashboardStats } from '@/api/dashboard'
import { render, screen, waitFor, within } from '@/test/render'
import AnalyticsView from './AnalyticsView'

interface ChartMockInstance {
  config: { type: string; data: { datasets: Array<Record<string, unknown>> } }
  data: { datasets: Array<{ data: number[] }>; labels: string[] }
}

const { chartInstances } = vi.hoisted(() => ({
  chartInstances: [] as ChartMockInstance[],
}))

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

vi.mock('@/api/dashboard', () => ({
  dashboardApi: {
    getIncomeTrend: vi.fn(),
    getStats: vi.fn(),
  },
}))

vi.mock('chart.js/auto', () => ({
  default: class ChartMock {
    data: { datasets: Array<{ data: number[] }>; labels: string[] }

    config: ChartMockInstance['config']

    constructor(_context: unknown, configuration: ChartMockInstance['config']) {
      this.config = configuration
      this.data = configuration.data as unknown as ChartMock['data']
      chartInstances.push(this)
    }

    destroy() {}

    update() {}
  },
}))

const stats: DashboardStats = {
  avg_collection_days: 12,
  avg_collection_days_trend: -2,
  overdue_amount: 50,
  overdue_trend: -1,
  paid_amount: 750,
  paid_trend: 5,
  pending_amount: 200,
  pending_trend: 3,
  total_amount: 1_000,
  total_trend: 4,
}

const apiResponse = <T,>(data: T) => ({ data: { data } })

describe('AnalyticsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chartInstances.length = 0
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
    vi.mocked(dashboardApi.getStats).mockResolvedValue(apiResponse(stats) as never)
    vi.mocked(dashboardApi.getIncomeTrend).mockResolvedValue(
      apiResponse({ actual_values: [750], expected_values: [1_000], labels: ['本期'] }) as never,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('explains early receipts as timing rather than a negative collection cycle', async () => {
    vi.mocked(dashboardApi.getStats).mockResolvedValue(
      apiResponse({ ...stats, avg_collection_days: -2 }) as never,
    )
    render(<AnalyticsView />)
    expect(await screen.findByText('提前 2 天')).toBeInTheDocument()
    expect(screen.getByText('平均到账偏差')).toBeInTheDocument()
    expect(screen.queryByText('-2 天')).not.toBeInTheDocument()
  })

  it('uses Orange Design System controls and switches the reporting period', async () => {
    const user = userEvent.setup()
    const { container } = render(<AnalyticsView />)

    await waitFor(() =>
      expect(dashboardApi.getStats).toHaveBeenCalledWith('month', expect.any(AbortSignal)),
    )
    const periodTabs = screen.getByRole('tablist', { name: '统计周期' })
    expect(periodTabs).toHaveAttribute('data-variant', 'accent')
    expect(screen.getByRole('tab', { name: '月' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(4)
    expect(screen.getByRole('tabpanel', { name: '月' })).toBeVisible()
    expect(container.querySelectorAll('.ods-tabs__tab')).toHaveLength(4)
    expect(screen.getByRole('button', { name: '导出报表' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
    // The header says what the page is for; the period lives in the tabs and on the chart axis.
    expect(screen.getByText('了解收款进度与资金结构')).toBeInTheDocument()
    expect(container.querySelector('.ods-page-header__eyebrow')).not.toBeInTheDocument()
    // Open sections, no cards.
    expect(container.querySelector('.ods-card')).not.toBeInTheDocument()
    expect(container.querySelector('.ods-summary-metric')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '收款趋势' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '收款结构' })).toBeInTheDocument()
    expect(container.querySelector('.glass-card')).not.toBeInTheDocument()
    expect(container.querySelector('.btn')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '周' }))

    await waitFor(() =>
      expect(dashboardApi.getStats).toHaveBeenCalledWith('week', expect.any(AbortSignal)),
    )
    expect(screen.getByRole('tab', { name: '周' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: '周' })).toBeVisible()
    expect(await screen.findByText('近7天收款趋势数据')).toBeInTheDocument()
  })

  it('shows four plain figures without trend badges', async () => {
    render(<AnalyticsView />)

    await screen.findByText('¥1,000')
    const figures = [...screen.getByLabelText('关键指标').querySelectorAll('.analytics-metric')]
    expect(figures.map((figure) => figure.textContent)).toEqual([
      '平均到账偏差延后 12 天',
      '预期收款¥1,000',
      '收款率75%',
      '逾期比例5%',
    ])
    expect(screen.queryByLabelText(/上升|下降|持平/)).not.toBeInTheDocument()
  })

  it('shows a dash instead of a zero rate when nothing is planned in the period', async () => {
    vi.mocked(dashboardApi.getStats).mockResolvedValue(
      apiResponse({ ...stats, overdue_amount: 0, paid_amount: 300, total_amount: 0 }) as never,
    )
    render(<AnalyticsView />)

    await screen.findByText('¥0')
    const figures = [...screen.getByLabelText('关键指标').querySelectorAll('.analytics-metric')]
    expect(figures[2]).toHaveTextContent('收款率—')
    expect(figures[3]).toHaveTextContent('逾期比例—')
  })

  it('draws the trend as a solid received line over a dashed planned line', async () => {
    render(<AnalyticsView />)

    await waitFor(() => expect(chartInstances).toHaveLength(1))
    const { config } = chartInstances[0]
    expect(config.type).toBe('line')
    const [actual, planned] = config.data.datasets
    expect(actual).toMatchObject({ fill: 'origin', label: '实际收款' })
    expect(actual.borderDash).toBeUndefined()
    expect(planned).toMatchObject({ borderDash: [8, 5], fill: false, label: '计划收款' })
    expect(
      [...screen.getByRole('list', { name: '图例' }).children].map((item) => item.textContent),
    ).toEqual(['实际收款', '计划收款'])
  })

  it('writes the trend axis as dates rather than raw API keys, and adds no range caption', async () => {
    vi.mocked(dashboardApi.getIncomeTrend).mockResolvedValue(
      apiResponse({
        actual_values: [750, 0],
        end_date: '2026-11-17',
        expected_values: [1_000, 0],
        labels: ['11-08', '2026-01'],
        start_date: '2026-10-19',
      }) as never,
    )
    render(<AnalyticsView />)

    await waitFor(() =>
      expect(chartInstances.at(-1)?.data.labels).toEqual(['11月8日', '2026年1月']),
    )
    const trend = within(screen.getByRole('region', { name: '收款趋势' }))
    expect(trend.getByRole('rowheader', { name: '11月8日' })).toBeInTheDocument()
    expect(trend.getByRole('rowheader', { name: '2026年1月' })).toBeInTheDocument()
    expect(trend.queryByText(/2026-10-19/)).not.toBeInTheDocument()
  })

  it('keeps the latest period when older stats and trend requests resolve last', async () => {
    const user = userEvent.setup()
    const monthStats = createDeferred<Awaited<ReturnType<typeof dashboardApi.getStats>>>()
    const weekStats = createDeferred<Awaited<ReturnType<typeof dashboardApi.getStats>>>()
    const monthTrend = createDeferred<Awaited<ReturnType<typeof dashboardApi.getIncomeTrend>>>()
    const weekTrend = createDeferred<Awaited<ReturnType<typeof dashboardApi.getIncomeTrend>>>()
    const latestStats = { ...stats, total_amount: 2_000 }

    vi.mocked(dashboardApi.getStats).mockImplementation((period) =>
      period === 'month' ? monthStats.promise : weekStats.promise,
    )
    vi.mocked(dashboardApi.getIncomeTrend).mockImplementation((period) =>
      period === 'month' ? monthTrend.promise : weekTrend.promise,
    )

    render(<AnalyticsView />)
    await waitFor(() =>
      expect(dashboardApi.getStats).toHaveBeenCalledWith('month', expect.any(AbortSignal)),
    )
    await user.click(screen.getByRole('tab', { name: '周' }))
    await waitFor(() =>
      expect(dashboardApi.getStats).toHaveBeenCalledWith('week', expect.any(AbortSignal)),
    )

    weekStats.resolve(apiResponse(latestStats) as never)
    weekTrend.resolve(
      apiResponse({
        actual_values: [1_500],
        expected_values: [2_000],
        labels: ['最新周'],
      }) as never,
    )
    await waitFor(() => expect(screen.getByText('¥2,000')).toBeInTheDocument())
    const trendChart = chartInstances.at(-1)
    await waitFor(() => expect(trendChart?.data.labels).toEqual(['最新周']))

    monthStats.resolve(apiResponse(stats) as never)
    monthTrend.resolve(
      apiResponse({ actual_values: [750], expected_values: [1_000], labels: ['旧月份'] }) as never,
    )
    await Promise.all([monthStats.promise, monthTrend.promise, Promise.resolve()])

    expect(screen.getByText('¥2,000')).toBeInTheDocument()
    expect(trendChart?.data.labels).toEqual(['最新周'])
  })

  it('does not relabel stale data while a new period is loading or after it fails', async () => {
    const user = userEvent.setup()
    const weekStats = createDeferred<Awaited<ReturnType<typeof dashboardApi.getStats>>>()
    const weekTrend = createDeferred<Awaited<ReturnType<typeof dashboardApi.getIncomeTrend>>>()

    vi.mocked(dashboardApi.getStats).mockImplementation((period) =>
      period === 'week' ? weekStats.promise : Promise.resolve(apiResponse(stats) as never),
    )
    vi.mocked(dashboardApi.getIncomeTrend).mockImplementation((period) =>
      period === 'week'
        ? weekTrend.promise
        : Promise.resolve(
            apiResponse({
              actual_values: [750],
              expected_values: [1_000],
              labels: ['本期'],
            }) as never,
          ),
    )

    render(<AnalyticsView />)
    await waitFor(() => expect(screen.getByText('¥1,000')).toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: '周' }))

    expect(screen.getByLabelText('关键指标')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status', { name: '收款趋势加载中' })).toBeInTheDocument()
    expect(screen.queryByText('¥1,000')).not.toBeInTheDocument()

    weekStats.reject(new Error('stats failed'))
    weekTrend.reject(new Error('trend failed'))

    await waitFor(() => expect(screen.getByText('趋势数据暂不可用')).toBeInTheDocument())
    expect(screen.getAllByText('暂不可用')).toHaveLength(4)
    expect(screen.getAllByRole('button', { name: '重新加载' })).toHaveLength(2)
    expect(screen.queryByText('¥1,000')).not.toBeInTheDocument()
  })

  it('splits the structure into received and pending, with overdue as a note on pending', async () => {
    render(<AnalyticsView />)

    await screen.findByText('¥1,000')
    const structure = within(screen.getByRole('region', { name: '收款结构' }))
    // 750 received against 200 still due: 79% / 21%. Overdue is inside pending, not a third part.
    expect(structure.getByRole('img', { name: '已收款 79%，待收款 21%' })).toBeInTheDocument()
    expect(
      [...structure.getByRole('img').querySelectorAll('circle')].map((part) =>
        part.getAttribute('data-part'),
      ),
    ).toEqual(['pending', 'paid'])
    expect(structure.getByText('已收款').closest('div')).toHaveTextContent('已收款¥750')
    expect(structure.getByText('待收款').closest('div')).toHaveTextContent('待收款¥200其中逾期 ¥50')
  })

  it('leaves the overdue note out when nothing is overdue', async () => {
    vi.mocked(dashboardApi.getStats).mockResolvedValue(
      apiResponse({ ...stats, overdue_amount: 0 }) as never,
    )
    render(<AnalyticsView />)

    await screen.findByText('¥1,000')
    expect(screen.queryByText(/其中逾期/)).not.toBeInTheDocument()
  })

  it('uses design-system empty states instead of blank canvases when a period has no data', async () => {
    vi.mocked(dashboardApi.getStats).mockResolvedValue(
      apiResponse({
        ...stats,
        overdue_amount: 0,
        paid_amount: 0,
        pending_amount: 0,
        total_amount: 0,
      }) as never,
    )
    vi.mocked(dashboardApi.getIncomeTrend).mockResolvedValue(
      apiResponse({ actual_values: [0], expected_values: [0], labels: ['本期'] }) as never,
    )

    const { container } = render(<AnalyticsView />)

    expect(await screen.findByText('本期暂无回款趋势')).toBeInTheDocument()
    expect(screen.getByText('本期暂无收款结构')).toBeInTheDocument()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
  })
})
