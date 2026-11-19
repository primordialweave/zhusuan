import dayjs from 'dayjs'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paymentApi, type Payment } from '@/api/project'
import { render, screen, waitFor, within } from '@/test/render'
import CalendarView from './CalendarView'

vi.mock('@/api/project', () => ({
  paymentApi: {
    list: vi.fn(),
  },
}))

const todayPayment = {
  actual_date: '',
  amount: 12_800,
  id: 1,
  method: '',
  percentage: 40,
  plan_date: '2026-10-17',
  project: { name: '星轨项目' },
  project_id: 1,
  remark: '',
  stage: '中期款',
  status: 'pending',
} as Payment

const named = (name: string) => ({ name }) as Payment['project']
const dayButton = (date: string) =>
  screen.getByRole('button', { name: new RegExp(`^${dayjs(date).format('YYYY年M月D日')}，`) })
const detail = () => within(screen.getByRole('complementary', { name: '收款明细' }))

describe('CalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 17, 12))
    vi.clearAllMocks()
    vi.mocked(paymentApi.list).mockResolvedValue({ data: { data: [todayPayment] } } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['2026-10-17', '2026年10月17日，星期六', '待收'],
    ['2026-10-17T00:00:00Z', '2026年10月17日，星期六', '待收'],
    ['2026-10-17T00:00:00+08:00', '2026年10月17日，星期六', '待收'],
    ['2026-10-17 00:00:00', '2026年10月17日，星期六', '待收'],
    ['2026-10-01T00:00:00+14:00', '2026年10月1日，星期四', '逾期'],
    ['2026-10-31T23:30:00-12:00', '2026年10月31日，星期六', '待收'],
  ])('files %s under its planned calendar day', async (planDate, day, status) => {
    const user = userEvent.setup()
    vi.mocked(paymentApi.list).mockResolvedValue({
      data: { data: [{ ...todayPayment, plan_date: planDate }] },
    } as never)

    render(<CalendarView />)

    const markedDay = await screen.findByRole('button', {
      name: `${day}，${status} ¥12,800，共 1 笔`,
    })
    expect(markedDay).toHaveAttribute('data-marked', 'true')
    expect(within(markedDay).getByText(`${status} ¥12,800`)).toBeInTheDocument()

    await user.click(markedDay)

    expect(markedDay).toHaveAttribute('data-selected', 'true')
    expect(detail().getAllByRole('link', { name: '星轨项目' })).toHaveLength(1)
    expect(detail().getByText(status)).toBeInTheDocument()
    expect(screen.queryByText('该日无收款计划')).not.toBeInTheDocument()
  })

  it.each([
    ['all', '全款'],
    ['deposit', '预付款'],
    ['final', '尾款'],
    ['milestone', '阶段款'],
    ['progress', '进度款'],
    ['process', '进度款'],
    ['验收款', '验收款'],
    ['', '收款'],
  ])('displays stage %s as %s', async (stage, label) => {
    vi.mocked(paymentApi.list).mockResolvedValue({
      data: { data: [{ ...todayPayment, stage }] },
    } as never)

    render(<CalendarView />)

    await screen.findByRole('link', { name: '星轨项目' })
    expect(screen.getByText(label, { exact: true })).toBeInTheDocument()
    if (stage && stage !== label) expect(screen.queryByText(stage)).not.toBeInTheDocument()
  })

  it('totals a day by status instead of reducing mixed statuses to one mark', async () => {
    const user = userEvent.setup()
    const payments: Payment[] = [
      { ...todayPayment, id: 1, plan_date: '2026-10-16T00:00:00Z', status: 'paid' },
      { ...todayPayment, id: 2, plan_date: '2026-10-16T00:00:00+08:00', status: 'pending' },
      {
        ...todayPayment,
        actual_date: '2026-10-18T00:00:00Z',
        amount: 1200.5,
        id: 3,
        plan_date: '2026-10-16',
        status: 'confirmed',
      },
    ]
    vi.mocked(paymentApi.list).mockResolvedValue({ data: { data: payments } } as never)

    const { container } = render(<CalendarView />)

    const markedDay = await screen.findByRole('button', {
      name: '2026年10月16日，星期五，逾期 ¥12,800，已收 ¥14,000.50，共 3 笔',
    })
    const lines = [...markedDay.querySelectorAll('.calendar-day-entry')]
    expect(lines.map((line) => line.textContent)).toEqual(['逾期 ¥12,800', '已收 ¥14,000.50'])
    expect(lines.map((line) => line.getAttribute('data-status'))).toEqual(['overdue', 'received'])
    expect(container.querySelector('.ods-calendar__marker')).not.toBeInTheDocument()

    await user.click(markedDay)

    // Every plan of the day is listed, the overdue one first.
    const entries = detail().getAllByRole('listitem')
    expect(entries).toHaveLength(3)
    expect(entries[0]).toHaveTextContent('逾期')
    expect(entries[1]).toHaveTextContent('已收')
    // A late arrival is noted, but the plan stays on its planned day.
    expect(entries[2]).toHaveTextContent('中期款 · 10月18日到账')
    expect(entries[2]).toHaveTextContent('¥1,200.50')
  })

  it('lays out an open month ledger beside the selected day', async () => {
    const user = userEvent.setup()
    const { container } = render(<CalendarView />)

    const entryLink = await screen.findByRole('link', { name: '星轨项目' })
    expect(paymentApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ end_date: '2026-10-31', start_date: '2026-10-01' }),
    )

    expect(screen.getByRole('heading', { level: 1, name: '收款日历' })).toBeInTheDocument()
    expect(document.querySelector('.ods-page-header__description, .scene-page__text')).toBeNull()
    expect(container.querySelector('.ods-summary-metric')).not.toBeInTheDocument()
    expect(container.querySelector('.ods-card')).not.toBeInTheDocument()

    const calendar = container.querySelector('.ods-calendar')!
    expect(calendar).toHaveAttribute('data-layout', 'board')
    expect(calendar.querySelector('.ods-calendar__weekday')).toHaveTextContent('日')
    expect(screen.getByRole('button', { name: '本月' })).toHaveAttribute('data-variant', 'outline')

    // The selected date is the heading of the detail column.
    expect(detail().getByRole('heading', { level: 2, name: '10月17日 · 周六' })).toBeInTheDocument()
    expect(detail().getByRole('heading', { level: 2, name: '近期收款' })).toBeInTheDocument()
    expect(entryLink).toHaveAttribute('href', '/projects/1?tab=payments&payment=1')
    const entry = entryLink.closest('li')!
    expect(entry).toHaveTextContent('中期款')
    expect(entry).toHaveTextContent('¥12,800')
    expect(within(entry).getByText('待收').closest('.ods-chip')).toHaveAttribute(
      'data-tone',
      'warning',
    )

    await user.click(screen.getByRole('button', { name: '下个月' }))

    await waitFor(() => expect(paymentApi.list).toHaveBeenCalledTimes(2))
    expect(paymentApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ end_date: '2026-11-30', start_date: '2026-11-01' }),
    )
    expect(screen.getByRole('button', { name: '选择年份' })).toHaveTextContent('2026年')
    expect(screen.getByRole('button', { name: '选择月份' })).toHaveTextContent('11月')
    // The day of month carries over to the new month.
    expect(dayButton('2026-11-17')).toHaveAttribute('data-selected', 'true')
    expect(detail().getByRole('heading', { level: 2, name: '11月17日 · 周二' })).toBeInTheDocument()
  })

  it('clamps the carried day to the end of a shorter month', async () => {
    const user = userEvent.setup()
    render(<CalendarView />, { initialEntries: ['/calendar?date=2026-10-31'] })
    await screen.findByText('该日无收款计划')

    await user.click(screen.getByRole('button', { name: '下个月' }))

    expect(dayButton('2026-11-30')).toHaveAttribute('data-selected', 'true')
  })

  it('derives overdue plans from a pending status and a past plan date', async () => {
    const user = userEvent.setup()
    vi.mocked(paymentApi.list).mockResolvedValue({
      data: { data: [{ ...todayPayment, id: 2, plan_date: '2026-10-16' }] },
    } as never)

    render(<CalendarView />)

    const markedDay = await screen.findByRole('button', {
      name: '2026年10月16日，星期五，逾期 ¥12,800，共 1 笔',
    })
    await user.click(markedDay)

    expect(detail().getByText('逾期').closest('.ods-chip')).toHaveAttribute('data-tone', 'danger')
    // An overdue plan is not an upcoming one.
    expect(detail().getByText('本月没有其他待收款项')).toBeInTheDocument()
  })

  it('shows an unavailable state on failure and retries the visible month', async () => {
    const user = userEvent.setup()
    vi.mocked(paymentApi.list)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ data: { data: [todayPayment] } } as never)

    render(<CalendarView />)

    expect(await screen.findByText('收款计划暂时不可用')).toBeInTheDocument()
    expect(screen.queryByText('该日无收款计划')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '近期收款' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重试' }))

    expect(await screen.findByRole('link', { name: '星轨项目' })).toBeInTheDocument()
    expect(paymentApi.list).toHaveBeenCalledTimes(2)
    expect(paymentApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ end_date: '2026-10-31', start_date: '2026-10-01' }),
    )
    expect(screen.queryByText('收款计划暂时不可用')).not.toBeInTheDocument()
  })

  it('lists upcoming pending plans in date order and selects the day of the one clicked', async () => {
    const user = userEvent.setup()
    const payments: Payment[] = [
      { ...todayPayment, id: 1, project: named('今日款项') },
      { ...todayPayment, id: 2, plan_date: '2026-10-31', project: named('月底款项') },
      { ...todayPayment, id: 3, plan_date: '2026-10-20', project: named('下周款项') },
      { ...todayPayment, id: 4, plan_date: '2026-10-22', project: named('已到账'), status: 'paid' },
      { ...todayPayment, id: 5, plan_date: '2026-10-10', project: named('逾期款项') },
    ]
    vi.mocked(paymentApi.list).mockResolvedValue({ data: { data: payments } } as never)
    render(<CalendarView />)

    await screen.findByRole('link', { name: '今日款项' })
    const upcoming = () =>
      within(detail().getByRole('heading', { name: '近期收款' }).closest('section')!)
    // The selected day is already shown above; received and overdue plans are not upcoming.
    expect(
      upcoming()
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['10月20日下周款项', '10月31日月底款项'])

    await user.click(upcoming().getByRole('link', { name: /下周款项/ }))

    expect(dayButton('2026-10-20')).toHaveAttribute('data-selected', 'true')
    expect(detail().getByRole('heading', { level: 2, name: '10月20日 · 周二' })).toBeInTheDocument()
    expect(
      upcoming()
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['10月17日今日款项', '10月31日月底款项'])
    expect(paymentApi.list).toHaveBeenCalledTimes(1)
  })

  it('caps the upcoming list and says how many more there are', async () => {
    const payments = Array.from({ length: 7 }, (_, index) => ({
      ...todayPayment,
      id: index + 1,
      plan_date: `2026-10-${20 + index}`,
    })) as Payment[]
    vi.mocked(paymentApi.list).mockResolvedValue({ data: { data: payments } } as never)
    render(<CalendarView />)

    expect(await screen.findByText('另有 2 笔')).toBeInTheDocument()
    expect(detail().getAllByRole('listitem')).toHaveLength(5)
  })

  it('opens a linked date in its own month', async () => {
    vi.mocked(paymentApi.list).mockResolvedValue({
      data: { data: [{ ...todayPayment, plan_date: '2026-11-12T00:00:00Z' }] },
    } as never)
    render(<CalendarView />, { initialEntries: ['/calendar?date=2026-11-12'] })

    await screen.findByRole('link', { name: '星轨项目' })
    expect(paymentApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ start_date: '2026-11-01', end_date: '2026-11-30' }),
    )
    expect(dayButton('2026-11-12')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('button', { name: '选择月份' })).toHaveTextContent('11月')
    // November 2026 starts on a Sunday and needs only five weeks.
    expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(5)
  })

  it('keeps the current month loaded when selecting a day and using the current-month action', async () => {
    const user = userEvent.setup()
    render(<CalendarView />)
    await screen.findByRole('link', { name: '星轨项目' })

    await user.click(dayButton('2026-10-20'))
    expect(screen.getByText('该日无收款计划')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '本月' }))
    expect(dayButton('2026-10-17')).toHaveAttribute('data-selected', 'true')
    expect(screen.queryByRole('status', { name: '正在加载收款计划' })).not.toBeInTheDocument()
    expect(paymentApi.list).toHaveBeenCalledTimes(1)
  })
})
