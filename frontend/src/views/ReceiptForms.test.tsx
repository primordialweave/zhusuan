import { fireEvent, screen, within } from '@testing-library/react'
import dayjs from 'dayjs'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dictionaryApi } from '@/api/dictionary'
import { paymentApi, projectApi, type Project } from '@/api/project'
import { createPaymentPlanItem } from '@/components/project/paymentPlan'
import { render } from '@/test/render'
import ProjectCreateView from './ProjectCreateView'
import PaymentCreateView from './PaymentCreateView'

vi.mock('@/api/dictionary', () => ({ dictionaryApi: { getItems: vi.fn() } }))
vi.mock('@/api/project', () => ({
  projectApi: {
    create: vi.fn(),
    get: vi.fn(),
    getPayments: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    generateContractNumber: vi.fn(),
  },
  paymentApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/design-system', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/design-system')>()
  return {
    ...original,
    DatePicker: ({
      'aria-label': label,
      value,
      onValueChange,
    }: {
      'aria-label'?: string
      value?: string
      onValueChange: (value: string) => void
    }) => (
      <input
        aria-label={label}
        value={value || ''}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
    ),
  }
})

const project: Project = {
  id: 42,
  name: '合同项目',
  company: '客户',
  total_amount: 10000,
  received_amount: 0,
  status: 'active',
  type: 'software',
  contract_number: 'KEEP-001',
  contract_date: '2026-11-22T00:00:00Z',
  payment_method: '一次性付款',
  start_date: '2026-11-22T00:00:00Z',
  end_date: '2026-12-22T00:00:00Z',
  description: '',
  create_time: '2026-11-22',
}
const response = <T,>(data: T) => ({ data: { data } })
const legacy = {
  id: 7,
  project_id: 42,
  amount: 100,
  percentage: 1,
  stage: 'custom-stage',
  method: 'custom-method',
  plan_date: '2026-12-02T00:00:00+08:00',
  actual_date: null,
  status: 'pending',
  remark: '',
}

function renderForm(path = '/projects/edit/42') {
  return render(
    <Routes>
      <Route path="/projects/create" element={<ProjectCreateView />} />
      <Route path="/projects/edit/:id" element={<ProjectCreateView />} />
      <Route path="/projects/:id/payment/create" element={<PaymentCreateView />} />
      <Route path="/projects" element={<h1>项目列表</h1>} />
      <Route path="/projects/:id" element={<h1>项目详情</h1>} />
    </Routes>,
    { initialEntries: [path] },
  )
}

async function fillMetadata() {
  fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: '新项目' } })
  fireEvent.change(screen.getByLabelText(/客户名称/), { target: { value: '新客户' } })
  fireEvent.click(await screen.findByLabelText('项目类型'))
  fireEvent.click(screen.getByRole('option', { name: '软件开发' }))
  for (const label of ['开始日期', '截止日期', '合同日期']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: '2026-11-22' } })
  }
  fireEvent.change(screen.getByLabelText(/合同总金额/), { target: { value: '10000' } })
}

describe('actual receipt forms', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(dictionaryApi.getItems).mockResolvedValue(
      response([{ label: '软件开发', value: 'software' }]) as never,
    )
    vi.mocked(projectApi.get).mockResolvedValue(response(project) as never)
    vi.mocked(projectApi.list).mockResolvedValue(response({ list: [project] }) as never)
    vi.mocked(projectApi.getPayments).mockResolvedValue(response([legacy]) as never)
    vi.mocked(projectApi.create).mockResolvedValue(response(project) as never)
    vi.mocked(projectApi.update).mockResolvedValue(response(project) as never)
    vi.mocked(projectApi.generateContractNumber).mockResolvedValue(
      response({ contract_number: 'NEW-001' }) as never,
    )
    vi.mocked(paymentApi.create).mockResolvedValue(response({ id: 8 }) as never)
    vi.mocked(paymentApi.update).mockResolvedValue(response({ id: 7 }) as never)
    vi.mocked(paymentApi.delete).mockResolvedValue(response(null) as never)
  })

  it('starts a new receipt as confirmed with today as the actual date', () => {
    expect(createPaymentPlanItem()).toMatchObject({
      status: 'confirmed',
      actualDate: dayjs().format('YYYY-MM-DD'),
      stage: 'receipt',
    })
  })

  it('edits receipts in the same earliest-actual-date order regardless of API plan order', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      response([
        {
          ...legacy,
          id: 8,
          amount: 200,
          status: 'confirmed',
          actual_date: '2026-11-21T00:00:00Z',
          plan_date: '2026-01-01',
        },
        {
          ...legacy,
          id: 7,
          amount: 100,
          status: 'confirmed',
          actual_date: '2026-10-16T23:00:00-12:00',
          plan_date: '2026-12-31',
        },
      ]) as never,
    )
    renderForm()
    await screen.findByDisplayValue('合同项目')
    const first = within(screen.getByRole('group', { name: '第 1 笔收款' }))
    const second = within(screen.getByRole('group', { name: '第 2 笔收款' }))
    expect(first.getByLabelText('实际到账日期')).toHaveValue('2026-10-16')
    expect(first.getByLabelText(/收款金额/)).toHaveValue('100')
    expect(second.getByLabelText('实际到账日期')).toHaveValue('2026-11-21')
    expect(second.getByLabelText(/收款金额/)).toHaveValue('200')
    fireEvent.change(second.getByLabelText('实际到账日期'), { target: { value: '2026-09-01' } })
    const reordered = within(screen.getByRole('group', { name: '第 1 笔收款' }))
    expect(reordered.getByLabelText('实际到账日期')).toHaveValue('2026-09-01')
    expect(reordered.getByLabelText(/收款金额/)).toHaveValue('200')
  })

  it('creates a contract without requiring any receipt or payment plan', async () => {
    renderForm('/projects/create')
    await fillMetadata()
    expect(screen.queryByRole('group', { name: /第 .* 收款/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目列表' })
    expect(projectApi.create).toHaveBeenCalledOnce()
    expect(paymentApi.create).not.toHaveBeenCalled()
  })

  it.each(['pending', 'overdue', 'confirmed'])(
    'does not rewrite an unchanged legacy %s payment with a missing actual date',
    async (status) => {
      vi.mocked(projectApi.getPayments).mockResolvedValue(
        response([{ ...legacy, status }]) as never,
      )
      renderForm()
      await screen.findByDisplayValue('合同项目')
      fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: '仅修改名称' } })
      fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
      await screen.findByRole('heading', { name: '项目列表' })
      expect(projectApi.update).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ name: '仅修改名称', contract_number: 'KEEP-001' }),
      )
      expect(paymentApi.update).not.toHaveBeenCalled()
      expect(paymentApi.create).not.toHaveBeenCalled()
      expect(paymentApi.delete).not.toHaveBeenCalled()
    },
  )

  it('preserves the actual calendar day, old plan date and custom method and classification when editing a receipt', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      response([
        { ...legacy, status: 'confirmed', actual_date: '2026-11-15T23:00:00-12:00' },
      ]) as never,
    )
    renderForm()
    await screen.findByDisplayValue('合同项目')
    expect(screen.getByLabelText('实际到账日期')).toHaveValue('2026-11-15')
    fireEvent.change(screen.getByLabelText(/收款金额/), { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目列表' })
    expect(paymentApi.update).toHaveBeenCalledExactlyOnceWith(
      7,
      expect.objectContaining({
        actual_date: '2026-11-15',
        plan_date: '2026-12-02',
        amount: 200,
        status: 'confirmed',
        method: 'custom-method',
        stage: 'custom-stage',
      }),
    )
  })

  it('registers a legacy pending payment only after the explicit receipt action', async () => {
    renderForm()
    await screen.findByDisplayValue('合同项目')
    fireEvent.click(screen.getByRole('button', { name: '登记到账' }))
    expect(screen.getByLabelText('实际到账日期')).toHaveValue(dayjs().format('YYYY-MM-DD'))
    fireEvent.change(screen.getByLabelText('实际到账日期'), { target: { value: '2026-11-18' } })
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目列表' })
    expect(paymentApi.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        status: 'confirmed',
        actual_date: '2026-11-18',
        plan_date: '2026-12-02',
      }),
    )
  })

  it('allows multiple actual receipts in the dedicated entry regardless of the contract payment mode', async () => {
    renderForm('/projects/42/payment/create')
    await screen.findByRole('heading', { name: '录入收款' })
    fireEvent.change(await screen.findByLabelText(/收款金额/), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: '添加收款' }))
    const second = within(screen.getByRole('group', { name: '第 2 笔收款' }))
    fireEvent.change(second.getByLabelText(/收款金额/), { target: { value: '200' } })
    fireEvent.change(second.getByLabelText('实际到账日期'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目详情' })
    expect(paymentApi.create).toHaveBeenCalledTimes(2)
    expect(paymentApi.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ amount: 200, status: 'confirmed', actual_date: '2026-11-20' }),
    )
    expect(screen.queryByText('待分配')).not.toBeInTheDocument()
  })

  it('requires the actual date for a new receipt while allowing its classification to be empty', async () => {
    renderForm('/projects/42/payment/create')
    fireEvent.change(await screen.findByLabelText(/收款金额/), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('实际到账日期'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    expect(screen.getByText('请选择实际到账日期')).toBeInTheDocument()
    expect(paymentApi.create).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('实际到账日期'), { target: { value: '2026-11-19' } })
    fireEvent.click(screen.getByRole('button', { name: '清除收款分类' }))
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目详情' })
    expect(paymentApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ actual_date: '2026-11-19', stage: 'receipt', status: 'confirmed' }),
    )
    expect(vi.mocked(paymentApi.create).mock.calls[0]?.[0]).not.toHaveProperty('plan_date')
  })

  it('keeps all receipt records when the contract payment mode changes', async () => {
    vi.mocked(projectApi.get).mockResolvedValue(
      response({ ...project, payment_method: '分期付款' }) as never,
    )
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      response([
        { ...legacy, status: 'confirmed', actual_date: '2026-11-15T00:00:00Z' },
        { ...legacy, id: 8, status: 'confirmed', actual_date: '2026-11-16T00:00:00Z', amount: 200 },
      ]) as never,
    )
    renderForm()
    await screen.findByDisplayValue('合同项目')
    fireEvent.click(screen.getByRole('button', { name: '付款模式' }))
    fireEvent.click(screen.getByRole('option', { name: '一次性付款' }))
    const groups = screen.getAllByRole('group', { name: /第 .* 笔收款/ })
    expect(groups).toHaveLength(2)
    expect(within(groups[0]!).getByLabelText(/收款金额/)).toHaveValue('100')
    expect(within(groups[1]!).getByLabelText(/收款金额/)).toHaveValue('200')
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目列表' })
    expect(paymentApi.delete).not.toHaveBeenCalled()
    expect(paymentApi.update).not.toHaveBeenCalled()
  })
})
