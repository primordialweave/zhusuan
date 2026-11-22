import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import PaymentSummary from './PaymentSummary'

describe('PaymentSummary', () => {
  it('keeps retry and contract scope controls available on failure without showing false amounts', async () => {
    const retry = vi.fn()
    const user = userEvent.setup()
    render(
      <PaymentSummary
        paid={3600}
        pending={2400}
        scope="month"
        status="error"
        onScopeChange={vi.fn()}
        onRetry={retry}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('收款数据加载失败')
    expect(
      screen.getByRole('button', { name: '合同范围：本月签约，点击切换到全部合同' }),
    ).toBeEnabled()
    expect(screen.queryByText('¥3,600')).not.toBeInTheDocument()
    expect(screen.queryByText('¥2,400')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(retry).toHaveBeenCalledOnce()
  })
  it('cycles the signed-contract scope by clicking the original pie with only two amount rows', async () => {
    const user = userEvent.setup()
    const onScopeChange = vi.fn()
    const { container } = render(
      <PaymentSummary
        paid={3600}
        pending={2400}
        scope="month"
        status="data"
        onScopeChange={onScopeChange}
      />,
    )
    expect(screen.getByRole('img', { name: '合同已收 60%，合同未收 40%' })).toBeInTheDocument()
    expect(screen.getByText('合同已收')).toBeInTheDocument()
    expect(screen.getByText('合同未收')).toBeInTheDocument()
    expect(container.querySelectorAll('.payment-summary__row')).toHaveLength(2)
    expect(container.querySelector('.payment-summary__cash')).not.toBeInTheDocument()
    expect(screen.queryByText(/累计收款|本年收款|本月收款/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '合同范围：本月签约，点击切换到全部合同' }))
    expect(onScopeChange).toHaveBeenCalledWith('all')
    expect(screen.getByRole('img', { name: '合同已收 60%，合同未收 40%' })).toBeInTheDocument()
    expect(screen.queryByText('本月待收款')).not.toBeInTheDocument()
  })
  it('shows skeletons instead of a false empty chart or amount while loading', () => {
    const { container } = render(<PaymentSummary paid={0} pending={0} status="loading" />)

    expect(screen.getByRole('region', { name: '收款摘要' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('正在加载收款摘要')
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '暂无合同数据' })).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('draws the paid share as a slice and names both amounts', () => {
    const { container } = render(<PaymentSummary paid={3600} pending={2400} status="data" />)

    expect(screen.getByRole('img', { name: '合同已收 60%，合同未收 40%' })).toBeInTheDocument()
    expect(screen.getByText('合同已收')).toBeInTheDocument()
    expect(screen.getByText('合同未收')).toBeInTheDocument()
    // 60% of the circumference of the r=8 circle the slice is stroked on.
    expect(container.querySelector('[data-part="paid"]')).toHaveAttribute(
      'stroke-dasharray',
      '30.159 50.265',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps the contract switch available when the selected scope has no contracts', () => {
    render(
      <PaymentSummary onScopeChange={vi.fn()} paid={0} pending={0} scope="month" status="data" />,
    )

    expect(screen.getByText('暂无合同数据')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '合同范围：本月签约，点击切换到全部合同' }),
    ).toBeEnabled()
  })
})
