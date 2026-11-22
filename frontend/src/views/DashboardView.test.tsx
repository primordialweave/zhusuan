import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardApi } from '@/api/dashboard'
import { render, screen, waitFor } from '@/test/render'
import DashboardView from './DashboardView'

vi.mock('@/api/dashboard', () => ({ dashboardApi: { getReceiptOverview: vi.fn() } }))

describe('DashboardView contract scope interaction', () => {
  let previousScope: string | null
  beforeEach(() => {
    previousScope = window.localStorage.getItem('workbenchSummaryScope')
    window.localStorage.setItem('workbenchSummaryScope', 'all')
    vi.resetAllMocks()
    vi.mocked(dashboardApi.getReceiptOverview).mockImplementation((scope) =>
      Promise.resolve({
        data: {
          data: {
            contract_received: scope === 'year' ? 900 : scope === 'month' ? 200 : 3600,
            outstanding_total: scope === 'year' ? 2100 : scope === 'month' ? 800 : 2400,
            overpaid_total: 0,
            period_received: scope === 'year' ? 1200 : scope === 'month' ? 600 : 9000,
          },
        },
      } as never),
    )
  })
  afterEach(() => {
    if (previousScope === null) window.localStorage.removeItem('workbenchSummaryScope')
    else window.localStorage.setItem('workbenchSummaryScope', previousScope)
  })

  it('changes contract amounts and the jade pie with mouse, space and enter scope switching', async () => {
    const user = userEvent.setup()
    const { container } = render(<DashboardView />)
    await waitFor(() =>
      expect(screen.getByRole('img', { name: '合同已收 60%，合同未收 40%' })).toBeInTheDocument(),
    )
    const paidSlice = () => container.querySelector('circle[data-part="paid"]')!
    expect(paidSlice()).toHaveAttribute('stroke-dasharray', '30.159 50.265')
    expect(container.querySelectorAll('.payment-summary__legend dt')).toHaveLength(2)
    expect(container.querySelector('.payment-summary__cash')).not.toBeInTheDocument()
    expect(screen.queryByText(/累计收款|本年收款|本月收款/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="select"]')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '合同范围：全部合同，点击切换到本年签约' }))
    await screen.findByRole('img', { name: '合同已收 30%，合同未收 70%' })
    expect(screen.getByText('合同已收').closest('.payment-summary__row')).toHaveTextContent('¥900')
    expect(screen.getByText('合同未收').closest('.payment-summary__row')).toHaveTextContent(
      '¥2,100',
    )
    expect(paidSlice()).toHaveAttribute('stroke-dasharray', '15.080 50.265')
    expect(screen.queryByText('¥1,200')).not.toBeInTheDocument()
    expect(dashboardApi.getReceiptOverview).toHaveBeenLastCalledWith(
      'year',
      expect.any(AbortSignal),
    )
    await user.keyboard(' ')
    await screen.findByRole('img', { name: '合同已收 20%，合同未收 80%' })
    expect(screen.getByText('合同已收').closest('.payment-summary__row')).toHaveTextContent('¥200')
    expect(screen.getByText('合同未收').closest('.payment-summary__row')).toHaveTextContent('¥800')
    expect(window.localStorage.getItem('workbenchSummaryScope')).toBe('month')
    expect(paidSlice()).toHaveAttribute('stroke-dasharray', '10.053 50.265')
    expect(container.querySelector('button button')).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(dashboardApi.getReceiptOverview).toHaveBeenLastCalledWith(
        'all',
        expect.any(AbortSignal),
      ),
    )
    await waitFor(() =>
      expect(screen.getByRole('img', { name: '合同已收 60%，合同未收 40%' })).toBeInTheDocument(),
    )
    expect(screen.getByText('合同已收').closest('.payment-summary__row')).toHaveTextContent(
      '¥3,600',
    )
    expect(screen.getByText('合同未收').closest('.payment-summary__row')).toHaveTextContent(
      '¥2,400',
    )
    expect(window.localStorage.getItem('workbenchSummaryScope')).toBe('all')
  })

  it('shows a contract empty state when only receipts from other signing periods arrived', async () => {
    vi.mocked(dashboardApi.getReceiptOverview).mockResolvedValue({
      data: {
        data: {
          contract_received: 0,
          outstanding_total: 0,
          overpaid_total: 0,
          period_received: 9000,
        },
      },
    } as never)
    window.localStorage.setItem('workbenchSummaryScope', 'month')
    const { container } = render(<DashboardView />)
    await screen.findByText('暂无合同数据')
    expect(screen.queryByText('¥9,000')).not.toBeInTheDocument()
    expect(container.querySelector('.payment-summary__cash')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '合同范围：本月签约，点击切换到全部合同' }),
    ).toBeEnabled()
    expect(dashboardApi.getReceiptOverview).toHaveBeenLastCalledWith(
      'month',
      expect.any(AbortSignal),
    )
  })
})
