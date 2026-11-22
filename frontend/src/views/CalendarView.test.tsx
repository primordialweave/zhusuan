import dayjs from 'dayjs'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardApi } from '@/api/dashboard'
import { render, screen, waitFor, within } from '@/test/render'
import CalendarView from './CalendarView'

vi.mock('@/api/dashboard', () => ({ dashboardApi: { getReceipts: vi.fn() } }))
vi.mock('@/api/project', () => ({ paymentApi: { list: vi.fn() } }))
const receipt = {
  id: 1,
  project_id: 2,
  amount: 100,
  plan_date: '2026-10-01',
  actual_date: '2026-10-17T00:00:00+08:00',
  status: 'confirmed',
  stage: 'all',
  project: { name: '实际到账项目' },
}
const response = (items: unknown[]) => ({ data: { data: items } })
const dayButton = (date: string) =>
  screen.getByRole('button', { name: new RegExp(`^${dayjs(date).format('YYYY年M月D日')}，`) })

describe('CalendarView actual receipts', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 17, 12))
    vi.resetAllMocks()
    vi.mocked(dashboardApi.getReceipts).mockResolvedValue(response([receipt]) as never)
    const { paymentApi } = await import('@/api/project')
    vi.mocked(paymentApi.list).mockResolvedValue(response([receipt]) as never)
  })
  afterEach(() => vi.useRealTimers())

  it('keeps waiting skeletons instead of a false empty result until the request finishes', async () => {
    let finish!: (value: never) => void
    vi.mocked(dashboardApi.getReceipts).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<CalendarView />)
    await waitFor(() => expect(dashboardApi.getReceipts).toHaveBeenCalledOnce())
    expect(screen.getByRole('status', { name: '正在加载收款记录' })).toBeInTheDocument()
    expect(screen.queryByText('该日无收款')).not.toBeInTheDocument()
    await act(async () => finish(response([]) as never))
    await screen.findByText('该日无收款')
    expect(screen.queryByRole('status', { name: '正在加载收款记录' })).not.toBeInTheDocument()
  })

  it('ignores a previous month response that arrives after the visible month', async () => {
    const user = userEvent.setup()
    let finish!: (value: never) => void
    vi.mocked(dashboardApi.getReceipts)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve
        }),
      )
      .mockResolvedValueOnce(
        response([
          { ...receipt, actual_date: '2026-11-17', project: { name: '本月到账' } },
        ]) as never,
      )
    render(<CalendarView />)
    await waitFor(() => expect(dashboardApi.getReceipts).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: '下个月' }))
    await screen.findByRole('link', { name: '本月到账' })
    await act(async () => finish(response([receipt]) as never))
    expect(screen.getByRole('link', { name: '本月到账' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '实际到账项目' })).not.toBeInTheDocument()
  })

  it('caps recent actual receipts and reports the remaining count', async () => {
    vi.mocked(dashboardApi.getReceipts).mockResolvedValue(
      response(
        Array.from({ length: 7 }, (_, index) => ({
          ...receipt,
          id: index + 2,
          actual_date: `2026-10-${10 + index}`,
        })),
      ) as never,
    )
    render(<CalendarView />)
    await screen.findByText('另有 2 笔')
    const recent = within(screen.getByRole('heading', { name: '近期收款' }).closest('section')!)
    expect(recent.getAllByRole('listitem')).toHaveLength(5)
  })

  it.each([
    ['receipt', '收款'],
    ['all', '全款'],
    ['progress', '进度款'],
    ['验收款', '验收款'],
  ])('keeps the historical receipt classification %s as %s', async (stage, label) => {
    vi.mocked(dashboardApi.getReceipts).mockResolvedValue(
      response([{ ...receipt, stage }]) as never,
    )
    render(<CalendarView />)
    await screen.findByRole('link', { name: '实际到账项目' })
    expect(screen.getByText(label, { exact: true })).toBeInTheDocument()
  })

  it('uses actual receipt dates even when the old planned date is different', async () => {
    render(<CalendarView />)
    const marked = await screen.findByRole('button', {
      name: '2026年10月17日，星期六，已收 ¥100，共 1 笔',
    })
    expect(marked).toHaveAttribute('data-marked', 'true')
    expect(dayButton('2026-10-01')).not.toHaveAttribute('data-marked', 'true')
    expect(dashboardApi.getReceipts).toHaveBeenCalledWith('2026-10-01', '2026-10-31')
  })

  it.each(['2026-10-01T00:00:00+14:00', '2026-10-31T23:30:00-12:00', '2026-10-17T00:00:00Z'])(
    'preserves the actual calendar date from %s without timezone conversion',
    async (actualDate) => {
      vi.mocked(dashboardApi.getReceipts).mockResolvedValue(
        response([{ ...receipt, actual_date: actualDate }]) as never,
      )
      const user = userEvent.setup()
      render(<CalendarView />)
      await waitFor(() =>
        expect(dayButton(actualDate.slice(0, 10))).toHaveAttribute('data-marked', 'true'),
      )
      await user.click(dayButton(actualDate.slice(0, 10)))
      expect(screen.getByRole('complementary', { name: '收款明细' })).toHaveTextContent(
        '实际到账项目',
      )
    },
  )

  it('does not present pending plans or undated historical receipts as dated cash', async () => {
    vi.mocked(dashboardApi.getReceipts).mockResolvedValue(
      response([
        { ...receipt, status: 'pending', project: { name: '旧待收计划' } },
        { ...receipt, id: 3, actual_date: null, project: { name: '无实际日期' } },
      ]) as never,
    )
    render(<CalendarView />)
    await screen.findByText('该日无收款')
    expect(screen.queryByText('旧待收计划')).not.toBeInTheDocument()
    expect(screen.queryByText('无实际日期')).not.toBeInTheDocument()
  })

  it('retains skeletons until the response arrives, ends failures and retries the visible month', async () => {
    const user = userEvent.setup()
    vi.mocked(dashboardApi.getReceipts).mockRejectedValueOnce(new Error('offline'))
    render(<CalendarView />)
    expect(screen.getByRole('status', { name: '正在加载收款记录' })).toBeInTheDocument()
    await screen.findByText('收款记录暂时不可用')
    expect(screen.queryByText('实际到账项目')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('link', { name: '实际到账项目' })
    expect(dashboardApi.getReceipts).toHaveBeenCalledTimes(2)
  })

  it('lists other receipts by actual date descending and selects one without requesting the month again', async () => {
    const user = userEvent.setup()
    vi.mocked(dashboardApi.getReceipts).mockResolvedValue(
      response([
        receipt,
        { ...receipt, id: 3, actual_date: '2026-10-16', project: { name: '昨日到账' } },
        { ...receipt, id: 4, actual_date: '2026-10-10', project: { name: '上周到账' } },
      ]) as never,
    )
    render(<CalendarView />)
    await screen.findByRole('link', { name: '实际到账项目' })
    const recent = () =>
      within(screen.getByRole('heading', { name: '近期收款' }).closest('section')!)
    expect(
      recent()
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['10月16日昨日到账', '10月10日上周到账'])
    await user.click(recent().getByRole('link', { name: /昨日到账/ }))
    expect(dayButton('2026-10-16')).toHaveAttribute('data-selected', 'true')
    expect(dashboardApi.getReceipts).toHaveBeenCalledOnce()
  })

  it('opens linked months and carries the selected day to the end of a shorter month', async () => {
    const user = userEvent.setup()
    render(<CalendarView />, { initialEntries: ['/calendar?date=2026-10-31'] })
    await screen.findByText('该日无收款')
    await user.click(screen.getByRole('button', { name: '下个月' }))
    await waitFor(() =>
      expect(dashboardApi.getReceipts).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30'),
    )
    expect(dayButton('2026-11-30')).toHaveAttribute('data-selected', 'true')
  })

  it('marks the sum of confirmed receipts and preserves precise amounts', async () => {
    vi.mocked(dashboardApi.getReceipts).mockResolvedValue(
      response([receipt, { ...receipt, id: 3, amount: 20.5 }]) as never,
    )
    render(<CalendarView />)
    expect(
      await screen.findByRole('button', { name: '2026年10月17日，星期六，已收 ¥120.50，共 2 笔' }),
    ).toHaveAttribute('data-marked', 'true')
  })
})
