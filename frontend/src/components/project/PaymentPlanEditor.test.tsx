import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@/test/render'
import { PaymentPlanEditor } from './PaymentPlanEditor'
import { createPaymentPlanItem, type PaymentPlanItem } from './paymentPlan'

const receipt: PaymentPlanItem = {
  ...createPaymentPlanItem(),
  amount: '12000',
  actualDate: '2026-08-01',
  remark: '首笔款',
}

describe('PaymentPlanEditor actual receipts', () => {
  it.each(['confirmed', 'paid'])(
    'shows the saved %s receipt without a state selector',
    (status) => {
      render(<PaymentPlanEditor items={[{ ...receipt, status }]} onItemsChange={vi.fn()} />)
      expect(screen.getByRole('button', { name: '实际到账日期' })).toHaveTextContent('2026-08-01')
      expect(screen.queryByRole('button', { name: '状态' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '登记到账' })).not.toBeInTheDocument()
    },
  )

  it.each([
    ['pending', '待收款'],
    ['overdue', '已逾期'],
  ])('preserves legacy %s without pretending it is received', (status, label) => {
    const onItemsChange = vi.fn()
    render(
      <PaymentPlanEditor
        items={[{ ...receipt, id: 7, status, actualDate: '', planDate: '2026-08-01' }]}
        onItemsChange={onItemsChange}
      />,
    )
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '历史计划日期' })).toHaveTextContent('2026-08-01')
    expect(screen.getByRole('button', { name: '登记到账' })).toBeInTheDocument()
    expect(onItemsChange).not.toHaveBeenCalled()
  })

  it('sets the real date and confirmed status only on the explicit receipt action', async () => {
    const user = userEvent.setup()
    const onItemsChange = vi.fn()
    const pending = { ...receipt, id: 7, status: 'pending', actualDate: '', planDate: '2026-08-01' }
    render(<PaymentPlanEditor items={[pending]} onItemsChange={onItemsChange} />)
    await user.click(screen.getByRole('button', { name: '登记到账' }))
    expect(onItemsChange).toHaveBeenLastCalledWith([
      { ...pending, status: 'confirmed', actualDate: dayjs().format('YYYY-MM-DD') },
    ])
  })

  it('composes existing ODS fields and surfaces', () => {
    const { container } = render(<PaymentPlanEditor items={[receipt]} onItemsChange={vi.fn()} />)
    expect(container.querySelectorAll('.ods-field')).toHaveLength(5)
    expect(container.querySelector('.ods-input')).toBeInTheDocument()
    expect(container.querySelector('.ods-date-picker')).toBeInTheDocument()
    expect(container.querySelectorAll('.ods-select')).toHaveLength(2)
    expect(container.querySelector('.ods-textarea')).toBeInTheDocument()
    expect(container.querySelector('.ods-surface')).toHaveAttribute('data-focus-within', 'true')
    expect(screen.getByRole('button', { name: '添加收款' })).toHaveClass('ods-button')
  })

  it('adds and removes receipt drafts irrespective of the contract payment mode', async () => {
    const user = userEvent.setup()
    const onItemsChange = vi.fn()
    render(
      <PaymentPlanEditor installment={false} items={[receipt]} onItemsChange={onItemsChange} />,
    )
    await user.click(screen.getByRole('button', { name: '添加收款' }))
    expect(onItemsChange).toHaveBeenLastCalledWith([
      receipt,
      expect.objectContaining({ stage: 'receipt', status: 'confirmed' }),
    ])
    await user.click(screen.getByRole('button', { name: '删除第 1 笔收款' }))
    expect(onItemsChange).toHaveBeenLastCalledWith([])
    expect(screen.getByRole('button', { name: '收款分类' })).toBeEnabled()
  })

  it('allows optional classification and keeps the add action when empty', () => {
    const { rerender } = render(<PaymentPlanEditor items={[receipt]} onItemsChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '收款分类' })).not.toHaveAttribute(
      'aria-required',
      'true',
    )
    rerender(<PaymentPlanEditor items={[]} onItemsChange={vi.fn()} />)
    expect(screen.getByText('暂无收款记录')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加收款' })).toBeInTheDocument()
  })
})
