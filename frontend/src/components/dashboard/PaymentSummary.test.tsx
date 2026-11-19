import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import PaymentSummary from './PaymentSummary'

describe('PaymentSummary', () => {
  it('draws the paid share as a slice and names both amounts', () => {
    const { container } = render(<PaymentSummary paid={3600} pending={2400} status="data" />)

    expect(screen.getByRole('img', { name: '已收 60%，待收 40%' })).toBeInTheDocument()
    expect(screen.getByText('已收款金额')).toBeInTheDocument()
    expect(screen.getByText('待收款金额')).toBeInTheDocument()
    // 60% of the circumference of the r=8 circle the slice is stroked on.
    expect(container.querySelector('[data-part="paid"]')).toHaveAttribute(
      'stroke-dasharray',
      '30.159 50.265',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('moves to the next scope when the pie is pressed, and says which scope is shown', async () => {
    const user = userEvent.setup()
    const onScopeChange = vi.fn()
    const { rerender } = render(
      <PaymentSummary
        onScopeChange={onScopeChange}
        paid={10}
        pending={5}
        scope="all"
        status="data"
      />,
    )

    await user.click(screen.getByRole('button', { name: '统计范围：全部，点击切换到本年' }))
    expect(onScopeChange).toHaveBeenLastCalledWith('year')

    rerender(
      <PaymentSummary
        onScopeChange={onScopeChange}
        paid={10}
        pending={5}
        scope="month"
        status="data"
      />,
    )
    expect(screen.getByText('本月已收款')).toBeInTheDocument()
    expect(screen.getByText('本月待收款')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '统计范围：本月，点击切换到全部' }))
    expect(onScopeChange).toHaveBeenLastCalledWith('all')
  })

  it('keeps the switch available when a scope has no payments', () => {
    render(
      <PaymentSummary onScopeChange={vi.fn()} paid={0} pending={0} scope="month" status="data" />,
    )

    expect(screen.getByText('本月暂无收款数据')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /统计范围：本月/ })).toBeEnabled()
  })
})
