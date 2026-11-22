import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardApi } from '@/api/dashboard'
import { render, screen, waitFor, within } from '@/test/render'
import AnalyticsView from './AnalyticsView'

const { chartInstances, exportCsv } = vi.hoisted(() => ({
  chartInstances: [] as Array<{ data: { labels: string[]; datasets: Array<{ data: number[]; label: string }> }; config: { options: { animation: { duration: number } } } }>,
  exportCsv: vi.fn(),
}))

vi.mock('@/utils/csv', () => ({ exportCsv }))
vi.mock('@/api/dashboard', () => ({ dashboardApi: {
  getReceiptOverview: vi.fn(), getReceiptTrend: vi.fn(), getStats: vi.fn(), getIncomeTrend: vi.fn(),
} }))
vi.mock('chart.js/auto', () => ({ default: class {
  data
  config
  constructor(_context: unknown, config: typeof chartInstances[number]['config'] & { data: typeof chartInstances[number]['data'] }) {
    this.data = config.data
    this.config = config
    chartInstances.push(this)
  }
  destroy() {}
  update() {}
} }))

const overview = {
  contract_total: 6000, received_total: 3600, contract_received: 3600,
  outstanding_total: 2400, overpaid_total: 0, period_received: 1200, period_count: 2,
  start_date: '2026-01-01', end_date: '2026-12-31',
}
const response = <T,>(data: T) => ({ data: { data } })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('AnalyticsView actual receipts', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    chartInstances.length = 0
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
    vi.mocked(dashboardApi.getReceiptOverview).mockResolvedValue(response(overview) as never)
    vi.mocked(dashboardApi.getReceiptTrend).mockResolvedValue(response({ labels: ['2026-01'], actual_values: [1200], expected_values: [] }) as never)
    vi.mocked(dashboardApi.getStats).mockResolvedValue(response({ total_amount: 1000, paid_amount: 750, planned_received_amount: 800, pending_amount: 200, overdue_amount: 50, avg_collection_days: -2 }) as never)
    vi.mocked(dashboardApi.getIncomeTrend).mockResolvedValue(response({ labels: ['2026-01'], actual_values: [750], expected_values: [1000] }) as never)
  })
  afterEach(() => vi.restoreAllMocks())

  it('keeps all contract balances apart from the selected period cash receipts', async () => {
    render(<AnalyticsView />)
    const contract = within(await screen.findByRole('region', { name: '合同回款' }))
    await waitFor(() => expect(contract.getByText('未收余额').closest('div')).toHaveTextContent('¥2,400'))
    expect(contract.getByText('合同总额').closest('div')).toHaveTextContent('¥6,000')
    expect(contract.getByText('累计已收').closest('div')).toHaveTextContent('¥3,600')
    expect(contract.getByText('收款率').closest('div')).toHaveTextContent('60%')
    const period = within(screen.getByRole('region', { name: '本期收款' }))
    expect(period.getByText('收款金额').closest('div')).toHaveTextContent('¥1,200')
    expect(period.getByText('收款笔数').closest('div')).toHaveTextContent('2')
    expect(screen.queryByText('平均到账偏差')).not.toBeInTheDocument()
    expect(screen.queryByText('逾期比例')).not.toBeInTheDocument()
  })

  it('draws only actual receipts and keeps overpayments from erasing other contract balances', async () => {
    vi.mocked(dashboardApi.getReceiptOverview).mockResolvedValue(response({ ...overview, contract_total: 8000, received_total: 9000, contract_received: 4000, outstanding_total: 4000, overpaid_total: 5000 }) as never)
    render(<AnalyticsView />)
    await waitFor(() => expect(chartInstances.at(-1)?.data.datasets).toHaveLength(1))
    expect(chartInstances.at(-1)?.data.datasets[0]).toMatchObject({ label: '实际收款', data: [1200] })
    expect(screen.getByRole('img', { name: '已收款 50%，未收余额 50%' })).toBeInTheDocument()
    expect(screen.getByText('超收 ¥5,000')).toBeInTheDocument()
    expect(screen.queryByText('计划收款')).not.toBeInTheDocument()
  })

  it('uses natural scopes and changes period receipts without changing the contract summary', async () => {
    const user = userEvent.setup()
    vi.mocked(dashboardApi.getReceiptOverview).mockImplementation((scope) => Promise.resolve(response({ ...overview, period_received: scope === 'week' ? 50 : 1200 }) as never))
    render(<AnalyticsView />)
    await waitFor(() => expect(dashboardApi.getReceiptOverview).toHaveBeenCalledWith('year', expect.any(AbortSignal)))
    expect(screen.getByRole('tab', { name: '年' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: '周' }))
    await waitFor(() => expect(dashboardApi.getReceiptOverview).toHaveBeenLastCalledWith('week', expect.any(AbortSignal)))
    const cash = within(screen.getByRole('region', { name: '本期收款' }))
    await waitFor(() => expect(cash.getByText('收款金额').closest('div')).toHaveTextContent('¥50'))
    expect(within(screen.getByRole('region', { name: '合同回款' })).getByText('未收余额').closest('div')).toHaveTextContent('¥2,400')
  })

  it('exports contract balances and actual cash without planned or overdue fields', async () => {
    const user = userEvent.setup()
    exportCsv.mockResolvedValue({ status: 'saved', path: '/tmp/receipts.csv' })
    render(<AnalyticsView />)
    await waitFor(() => expect(screen.getByRole('button', { name: '导出报表' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '导出报表' }))
    await waitFor(() => expect(exportCsv).toHaveBeenCalledOnce())
    const rows = exportCsv.mock.calls[0][1]
    expect(rows).toContainEqual(['合同总额', 6000])
    expect(rows).toContainEqual(['累计已收', 3600])
    expect(rows).toContainEqual(['未收余额', 2400])
    expect(rows).toContainEqual(['本期收款金额', 1200])
    expect(rows).toContainEqual(['本期收款笔数', 2])
    expect(rows).toContainEqual(['2026-01', 1200])
    expect(JSON.stringify(rows)).not.toMatch(/计划|逾期|到账偏差/)
  })

  it('retains the newest scope when old overview and trend responses arrive later', async () => {
    const user = userEvent.setup()
    const oldOverview = deferred<never>()
    const oldTrend = deferred<never>()
    vi.mocked(dashboardApi.getReceiptOverview).mockImplementation((scope) => scope === 'year' ? oldOverview.promise : Promise.resolve(response({ ...overview, period_received: 55 }) as never))
    vi.mocked(dashboardApi.getReceiptTrend).mockImplementation((scope) => scope === 'year' ? oldTrend.promise : Promise.resolve(response({ labels: ['最新'], actual_values: [55], expected_values: [] }) as never))
    render(<AnalyticsView />)
    await waitFor(() => expect(dashboardApi.getReceiptOverview).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('tab', { name: '周' }))
    await waitFor(() => expect(chartInstances.at(-1)?.data.labels).toEqual(['最新']))
    oldOverview.resolve(response({ ...overview, period_received: 900 }) as never)
    oldTrend.resolve(response({ labels: ['旧'], actual_values: [900], expected_values: [] }) as never)
    await Promise.all([oldOverview.promise, oldTrend.promise])
    expect(chartInstances.at(-1)?.data.labels).toEqual(['最新'])
  })

  it('ends skeletons on failure and retries the same scope without presenting old cash', async () => {
    const user = userEvent.setup()
    vi.mocked(dashboardApi.getReceiptOverview).mockRejectedValueOnce(new Error('offline'))
    const { container } = render(<AnalyticsView />)
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出报表' })).toBeDisabled()
    await screen.findByText('趋势数据暂不可用')
    expect(screen.queryByText('¥1,200')).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: '重新加载' })[0])
    await waitFor(() => expect(screen.getByRole('button', { name: '导出报表' })).toBeEnabled())
    expect(dashboardApi.getReceiptOverview).toHaveBeenCalledTimes(2)
  })

  it('keeps valid contract balances when there are no receipts in the period', async () => {
    vi.mocked(dashboardApi.getReceiptOverview).mockResolvedValue(response({ ...overview, period_received: 0, period_count: 0 }) as never)
    vi.mocked(dashboardApi.getReceiptTrend).mockResolvedValue(response({ labels: ['2026-01'], actual_values: [0], expected_values: [] }) as never)
    render(<AnalyticsView />)
    await screen.findByText('本期暂无收款')
    expect(screen.getByRole('img', { name: '已收款 60%，未收余额 40%' })).toBeInTheDocument()
    expect(screen.queryByText('暂无合同')).not.toBeInTheDocument()
  })

  it('supports a chosen calendar month using the same receipt endpoints', async () => {
    const user = userEvent.setup()
    render(<AnalyticsView />)
    await waitFor(() => expect(screen.getByRole('button', { name: '导出报表' })).toBeEnabled())
    await user.click(screen.getByRole('tab', { name: '自选' }))
    await user.click(screen.getByRole('button', { name: '统计月份' }))
    await user.click(await screen.findByRole('option', { name: '3月' }))
    await waitFor(() => expect(dashboardApi.getReceiptTrend).toHaveBeenLastCalledWith({ month: 3, year: new Date().getFullYear() }, expect.any(AbortSignal)))
  })
})
