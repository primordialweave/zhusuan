import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paymentApi, projectApi, type Project } from '@/api/project'
import { useToastStore } from '@/composables/useToast'
import { render } from '@/test/render'
import PaymentCreateView from './PaymentCreateView'

vi.mock('@/api/project', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/project')>()
  return {
    ...original,
    paymentApi: {
      ...original.paymentApi,
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectApi: {
      ...original.projectApi,
      list: vi.fn(),
      get: vi.fn(),
    },
  }
})

const project = {
  company: '橙子科技',
  contract_date: '2026-07-01',
  contract_number: 'ORANGE-001',
  create_time: '2026-07-01',
  description: '',
  end_date: '2026-09-30',
  id: 42,
  name: '星轨项目',
  payment_method: '分期付款',
  received_amount: 20_000,
  start_date: '2026-07-01',
  status: 'active',
  total_amount: 100_000,
  type: 'software',
} satisfies Project

const singlePaymentProject = {
  ...project,
  id: 43,
  name: '年度维护项目',
  payment_method: '一次性付款',
} satisfies Project

async function fillPayment(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  amount: string,
) {
  const group = screen.getByRole('group', { name: `第 ${index} 笔收款` })
  await user.type(within(group).getByRole('textbox', { name: /收款金额/ }), amount)
  await user.click(within(group).getByRole('button', { name: '实际到账日期' }))
  await user.click(
    document.querySelector<HTMLButtonElement>(
      '[data-slot="popover"] .ods-calendar__day:not(:disabled)',
    )!,
  )
}

describe('PaymentCreateView design system migration', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(projectApi.list).mockResolvedValue({
      data: {
        data: {
          list: [project, singlePaymentProject],
          page: 1,
          page_size: 100,
          total: 2,
          total_pages: 1,
        },
      },
    } as never)
    vi.mocked(projectApi.get).mockResolvedValue({ data: { data: project } } as never)
    vi.mocked(paymentApi.update).mockResolvedValue({ data: { data: { id: 7 } } } as never)
    vi.mocked(paymentApi.delete).mockResolvedValue({ data: { data: null } } as never)
  })

  it('retries a failed fixed-project load without dropping the payment input', async () => {
    const user = userEvent.setup()
    vi.mocked(projectApi.get).mockRejectedValueOnce(new Error('网络不可用'))
    render(
      <Routes>
        <Route element={<PaymentCreateView />} path="/projects/:id/payment/create" />
      </Routes>,
      { initialEntries: ['/projects/42/payment/create'] },
    )
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: '确认保存' })).toBeDisabled()
    const amount = screen.getByRole('textbox', { name: /收款金额/ })
    await user.type(amount, '1234')
    await user.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('button', { name: '添加收款' })
    expect(screen.getByRole('textbox', { name: /收款金额/ })).toHaveValue('1234.00')
    expect(screen.getByRole('button', { name: '确认保存' })).toBeEnabled()
    expect(projectApi.get).toHaveBeenCalledTimes(2)
  })

  it('retains a successful payment and retries only the failed installment', async () => {
    const user = userEvent.setup()
    const errorToast = vi.spyOn(useToastStore.getState(), 'error').mockReturnValue(1)
    vi.mocked(paymentApi.create)
      .mockResolvedValueOnce({ data: { data: { id: 7 } } } as never)
      .mockRejectedValueOnce(new Error('计划日期格式错误'))
      .mockResolvedValueOnce({ data: { data: { id: 8 } } } as never)
    render(
      <Routes>
        <Route element={<PaymentCreateView />} path="/payment/create" />
        <Route element={<h1>项目详情</h1>} path="/projects/:id" />
      </Routes>,
      { initialEntries: ['/payment/create'] },
    )
    await screen.findByRole('button', { name: '添加收款' })
    await fillPayment(user, 1, '30000')
    await user.click(screen.getByRole('button', { name: '添加收款' }))
    await fillPayment(user, 2, '70000')
    await user.type(
      within(screen.getByRole('group', { name: '第 2 笔收款' })).getByRole('textbox', {
        name: '备注',
      }),
      '待保存备注',
    )
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('第 2 笔收款未保存')
    expect(errorToast).toHaveBeenCalledWith('第 2 笔收款未保存：计划日期格式错误')
    expect(screen.getByRole('button', { name: '选择项目' })).toBeDisabled()
    expect(
      within(screen.getByRole('group', { name: '第 2 笔收款' })).getByRole('textbox', {
        name: '备注',
      }),
    ).toHaveValue('待保存备注')
    expect(paymentApi.create).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目详情' })
    expect(paymentApi.create).toHaveBeenCalledTimes(3)
    expect(vi.mocked(paymentApi.create).mock.calls.map(([payload]) => payload.amount)).toEqual([
      30000, 70000, 70000,
    ])
    expect(paymentApi.update).not.toHaveBeenCalled()
  })

  it('keeps input changed during save and updates the returned payment ID instead of creating again', async () => {
    const user = userEvent.setup()
    let finish!: (value: never) => void
    vi.mocked(paymentApi.create).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(
      <Routes>
        <Route element={<PaymentCreateView />} path="/projects/:id/payment/create" />
        <Route element={<h1>项目详情</h1>} path="/projects/:id" />
      </Routes>,
      { initialEntries: ['/projects/42/payment/create'] },
    )
    await screen.findByRole('button', { name: '添加收款' })
    await fillPayment(user, 1, '30000')
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    await waitFor(() => expect(paymentApi.create).toHaveBeenCalledOnce())
    const amount = screen.getByRole('textbox', { name: /收款金额/ })
    await user.clear(amount)
    await user.type(amount, '40000')
    await act(async () => {
      finish({ data: { data: { id: 7 } } } as never)
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('新修改尚未保存')
    expect(screen.getByRole('textbox', { name: /收款金额/ })).toHaveValue('40000')
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目详情' })
    expect(paymentApi.create).toHaveBeenCalledOnce()
    expect(paymentApi.update).toHaveBeenCalledWith(7, expect.objectContaining({ amount: 40000 }))
  })

  it('uses the shared ODS payment editor and form actions', async () => {
    const { container } = render(
      <Routes>
        <Route element={<PaymentCreateView />} path="/payment/create" />
      </Routes>,
      { initialEntries: ['/payment/create'] },
    )

    expect(screen.getByRole('heading', { name: '录入收款' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '添加收款' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: '选择项目' })).toHaveClass('ods-button')
    expect(container.querySelector('.payment-plan-editor')).toBeInTheDocument()
    expect(container.querySelector('.ods-form-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认保存' })).toHaveClass('ods-button')
  })

  it('preserves multiple receipt drafts when the selected project changes payment mode', async () => {
    const user = userEvent.setup()
    render(
      <Routes>
        <Route element={<PaymentCreateView />} path="/payment/create" />
      </Routes>,
      { initialEntries: ['/payment/create'] },
    )

    await screen.findByRole('button', { name: '添加收款' })
    await user.click(screen.getByRole('button', { name: '添加收款' }))
    await user.click(screen.getByRole('button', { name: '选择项目' }))
    await user.click(screen.getByRole('option', { name: '年度维护项目' }))

    expect(screen.getByRole('button', { name: '添加收款' })).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: /第 .* 笔收款/ })).toHaveLength(2)
    for (const category of screen.getAllByRole('button', { name: '收款分类' }))
      expect(category).toBeEnabled()
  })

  it('loads a fixed project directly even when it is outside the first project page', async () => {
    const outsidePageProject = { ...project, id: 142, name: '列表后面的分期项目' }
    vi.mocked(projectApi.get).mockResolvedValue({ data: { data: outsidePageProject } } as never)
    render(
      <Routes>
        <Route element={<PaymentCreateView />} path="/projects/:id/payment/create" />
      </Routes>,
      { initialEntries: ['/projects/142/payment/create'] },
    )
    expect(screen.getByRole('status', { name: '正在加载收款表单' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(screen.queryByRole('button', { name: '确认保存' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '添加收款' })).toBeInTheDocument()
    expect(screen.getByText('列表后面的分期项目')).toBeInTheDocument()
    expect(projectApi.get).toHaveBeenCalledWith(142)
    expect(projectApi.list).not.toHaveBeenCalled()
  })

  it('does not apply an old fixed-project response after the route changes', async () => {
    let finish!: (data: never) => void
    vi.mocked(projectApi.get).mockImplementation((id) =>
      id === 42
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Promise.resolve({ data: { data: singlePaymentProject } } as never),
    )
    function ChangeProject() {
      const navigate = useNavigate()
      return <button onClick={() => navigate('/projects/43/payment/create')}>换项目</button>
    }
    const user = userEvent.setup()
    render(
      <Routes>
        <Route
          element={
            <>
              <ChangeProject />
              <PaymentCreateView />
            </>
          }
          path="/projects/:id/payment/create"
        />
      </Routes>,
      { initialEntries: ['/projects/42/payment/create'] },
    )
    await waitFor(() => expect(projectApi.get).toHaveBeenCalledWith(42))
    await user.click(screen.getByRole('button', { name: '换项目' }))
    await screen.findByText('年度维护项目')
    await act(async () => {
      finish({ data: { data: project } } as never)
    })
    expect(screen.getByRole('button', { name: '添加收款' })).toBeInTheDocument()
    expect(screen.queryByText('星轨项目')).not.toBeInTheDocument()
  })
})
