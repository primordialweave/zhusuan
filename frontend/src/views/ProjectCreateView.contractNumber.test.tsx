import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dictionaryApi } from '@/api/dictionary'
import { paymentApi, projectApi, type Project } from '@/api/project'
import { render } from '@/test/render'
import ProjectCreateView from './ProjectCreateView'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock('@/composables/useToast', () => ({
  useToastStore: (selector: (state: typeof toasts) => unknown) => selector(toasts),
}))
vi.mock('@/api/dictionary', () => ({ dictionaryApi: { getItems: vi.fn() } }))
vi.mock('@/api/project', () => ({
  projectApi: {
    create: vi.fn(),
    generateContractNumber: vi.fn(),
    get: vi.fn(),
    getPayments: vi.fn(),
    update: vi.fn(),
  },
  paymentApi: { create: vi.fn(), delete: vi.fn(), update: vi.fn() },
}))

// Date callbacks are the subject here; the existing form suite exercises the real calendar.
vi.mock('@/design-system', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/design-system')>()
  return {
    ...original,
    DatePicker: ({
      'aria-label': label,
      onValueChange,
      value,
    }: {
      'aria-label'?: string
      onValueChange: (value: string) => void
      value?: string
    }) => (
      <input
        aria-label={label}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        value={value || ''}
      />
    ),
  }
})

const project: Project = {
  company: '客户',
  contract_date: '2026-11-22',
  contract_number: 'MANUAL-EXISTING',
  create_time: '2026-11-22',
  description: '',
  end_date: '2026-12-22',
  id: 42,
  name: '项目',
  payment_method: '一次性付款',
  received_amount: 0,
  start_date: '2026-11-22',
  status: 'active',
  total_amount: 100,
  type: 'software',
}

const response = <T,>(data: T) => ({ data: { data } })
const numberResponse = (contractNumber: string) => response({ contract_number: contractNumber })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  void promise.catch(() => undefined)
  return { promise, resolve, reject }
}

const selectDate = (date: string) =>
  fireEvent.change(screen.getByLabelText('合同日期'), { target: { value: date } })
const numberInput = () => screen.getByLabelText('合同编号')

function OpenEditor() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/projects/edit/42')}>打开编辑</button>
}

function renderRoutes() {
  return render(
    <Routes>
      <Route
        element={
          <>
            <OpenEditor />
            <ProjectCreateView />
          </>
        }
        path="/projects/:mode/:id?"
      />
      <Route element={<div>项目列表</div>} path="/projects" />
    </Routes>,
    { initialEntries: ['/projects/create'] },
  )
}

async function fillProject() {
  fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: '新项目' } })
  fireEvent.change(screen.getByLabelText(/客户名称/), { target: { value: '新客户' } })
  fireEvent.click(await screen.findByLabelText('项目类型'))
  fireEvent.click(screen.getByRole('option', { name: '软件开发' }))
  fireEvent.click(screen.getByRole('button', { name: '添加收款' }))
  for (const label of ['开始日期', '截止日期', '实际到账日期']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: '2026-11-22' } })
  }
  fireEvent.change(screen.getByLabelText(/合同总金额/), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText(/收款金额/), { target: { value: '100' } })
}

describe('ProjectCreateView contract numbers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(dictionaryApi.getItems).mockResolvedValue(
      response([{ label: '软件开发', value: 'software' }]) as never,
    )
    vi.mocked(projectApi.generateContractNumber).mockResolvedValue(
      numberResponse('20261122-01') as never,
    )
    vi.mocked(projectApi.get).mockResolvedValue(response(project) as never)
    vi.mocked(projectApi.getPayments).mockResolvedValue(response([]) as never)
    vi.mocked(projectApi.create).mockResolvedValue(response(project) as never)
    vi.mocked(projectApi.update).mockResolvedValue(response(project) as never)
    vi.mocked(paymentApi.create).mockResolvedValue(response({ id: 7 }) as never)
  })

  it('shows the generated number after choosing a contract date and submits it', async () => {
    renderRoutes()
    selectDate('2026-11-22')
    await waitFor(() => expect(numberInput()).toHaveValue('20261122-01'))
    expect(projectApi.generateContractNumber).toHaveBeenCalledExactlyOnceWith('2026-11-22')
    await fillProject()
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByText('项目列表')
    expect(projectApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ contract_number: '20261122-01' }),
    )
  })

  it('refreshes an automatic number when the date changes and ignores older responses', async () => {
    const oldRequest = deferred<ReturnType<typeof numberResponse>>()
    vi.mocked(projectApi.generateContractNumber)
      .mockReturnValueOnce(oldRequest.promise as never)
      .mockResolvedValueOnce(numberResponse('20261123-01') as never)
      .mockResolvedValueOnce(numberResponse('20261124-01') as never)
    render(<ProjectCreateView />)
    selectDate('2026-11-22')
    selectDate('2026-11-23')
    await waitFor(() => expect(numberInput()).toHaveValue('20261123-01'))
    await act(async () => oldRequest.resolve(numberResponse('20261122-01')))
    expect(numberInput()).toHaveValue('20261123-01')
    selectDate('2026-11-24')
    await waitFor(() => expect(numberInput()).toHaveValue('20261124-01'))
  })

  it('preserves a manually entered number when the contract date changes', async () => {
    render(<ProjectCreateView />)
    fireEvent.change(numberInput(), { target: { value: 'MY-CONTRACT' } })
    selectDate('2026-11-22')
    await act(async () => {})
    expect(numberInput()).toHaveValue('MY-CONTRACT')
    expect(projectApi.generateContractNumber).not.toHaveBeenCalled()
  })

  it('does not overwrite manual input with a pending response', async () => {
    const request = deferred<ReturnType<typeof numberResponse>>()
    vi.mocked(projectApi.generateContractNumber).mockReturnValue(request.promise as never)
    render(<ProjectCreateView />)
    selectDate('2026-11-22')
    fireEvent.change(numberInput(), { target: { value: 'MY-CONTRACT' } })
    await act(async () => request.resolve(numberResponse('20261122-01')))
    expect(numberInput()).toHaveValue('MY-CONTRACT')
    expect(projectApi.generateContractNumber).toHaveBeenCalledOnce()
  })

  it('keeps a manually cleared number empty until another date selection', async () => {
    const request = deferred<ReturnType<typeof numberResponse>>()
    vi.mocked(projectApi.generateContractNumber).mockReturnValue(request.promise as never)
    render(<ProjectCreateView />)
    selectDate('2026-11-22')
    fireEvent.change(numberInput(), { target: { value: 'draft' } })
    fireEvent.change(numberInput(), { target: { value: '' } })
    await act(async () => request.resolve(numberResponse('20261122-01')))
    expect(numberInput()).toHaveValue('')
    expect(projectApi.generateContractNumber).toHaveBeenCalledOnce()
  })

  it('clears an automatic number when its contract date is cleared', async () => {
    render(<ProjectCreateView />)
    selectDate('2026-11-22')
    await waitFor(() => expect(numberInput()).toHaveValue('20261122-01'))
    selectDate('')
    expect(numberInput()).toHaveValue('')
    expect(projectApi.generateContractNumber).toHaveBeenCalledOnce()
  })

  it('preserves existing project numbers when editing the contract date', async () => {
    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: '打开编辑' }))
    await waitFor(() => expect(numberInput()).toHaveValue('MANUAL-EXISTING'))
    selectDate('2026-11-23')
    expect(numberInput()).toHaveValue('MANUAL-EXISTING')
    expect(projectApi.generateContractNumber).not.toHaveBeenCalled()
  })

  it('ignores a pending generated number after switching to an existing project', async () => {
    const request = deferred<ReturnType<typeof numberResponse>>()
    vi.mocked(projectApi.generateContractNumber).mockReturnValue(request.promise as never)
    renderRoutes()
    selectDate('2026-11-22')
    fireEvent.click(screen.getByRole('button', { name: '打开编辑' }))
    await waitFor(() => expect(numberInput()).toHaveValue('MANUAL-EXISTING'))
    await act(async () => request.resolve(numberResponse('20261122-01')))
    expect(numberInput()).toHaveValue('MANUAL-EXISTING')
    expect(projectApi.generateContractNumber).toHaveBeenCalledOnce()
  })

  it('allows saving with backend fallback when number generation fails', async () => {
    vi.mocked(projectApi.generateContractNumber).mockRejectedValue(new Error('offline'))
    renderRoutes()
    selectDate('2026-11-22')
    await waitFor(() => expect(projectApi.generateContractNumber).toHaveBeenCalledOnce())
    await fillProject()
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByText('项目列表')
    expect(projectApi.create).toHaveBeenCalledWith(expect.objectContaining({ contract_number: '' }))
  })

  it('ignores responses during saving and retains an accepted project number on partial retry', async () => {
    const request = deferred<ReturnType<typeof numberResponse>>()
    const saved = deferred<ReturnType<typeof response<Project>>>()
    vi.mocked(projectApi.generateContractNumber).mockReturnValue(request.promise as never)
    vi.mocked(projectApi.create).mockReturnValue(saved.promise as never)
    vi.mocked(paymentApi.create).mockRejectedValue(new Error('payment offline'))
    renderRoutes()
    selectDate('2026-11-22')
    await fillProject()
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await waitFor(() => expect(projectApi.create).toHaveBeenCalledOnce())
    await act(async () => request.resolve(numberResponse('20261122-01')))
    expect(numberInput()).toHaveValue('')
    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: '保存期间的新名称' } })
    await act(async () => saved.resolve(response(project)))
    await screen.findByRole('alert')
    expect(numberInput()).toHaveValue('MANUAL-EXISTING')
    expect(screen.getByLabelText(/项目名称/)).toHaveValue('保存期间的新名称')
    selectDate('2026-11-23')
    expect(projectApi.generateContractNumber).toHaveBeenCalledOnce()
    expect(numberInput()).toHaveValue('MANUAL-EXISTING')
    vi.mocked(paymentApi.create).mockResolvedValue(response({ id: 7 }) as never)
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByText('项目列表')
    expect(projectApi.update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        contract_number: 'MANUAL-EXISTING',
        name: '保存期间的新名称',
      }),
    )
    expect(projectApi.create).toHaveBeenCalledOnce()
  })

  it('preserves a new manual number entered while the project save is pending', async () => {
    const saved = deferred<ReturnType<typeof response<Project>>>()
    vi.mocked(projectApi.generateContractNumber).mockRejectedValue(new Error('offline'))
    vi.mocked(projectApi.create).mockReturnValue(saved.promise as never)
    vi.mocked(paymentApi.create).mockRejectedValue(new Error('payment offline'))
    renderRoutes()
    selectDate('2026-11-22')
    await fillProject()
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await waitFor(() => expect(projectApi.create).toHaveBeenCalledOnce())
    fireEvent.change(numberInput(), { target: { value: 'NEW-MANUAL' } })
    await act(async () => saved.resolve(response(project)))
    await screen.findByRole('alert')
    expect(numberInput()).toHaveValue('NEW-MANUAL')
  })

  it('retains a regenerated number when an edited project has a partial payment failure', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      response([
        {
          id: 7,
          amount: 100,
          stage: 'all',
          method: 'bank_transfer',
          plan_date: '2026-11-22',
          status: 'pending',
        },
      ]) as never,
    )
    vi.mocked(projectApi.update).mockResolvedValue(
      response({ ...project, contract_number: '20261122-02' }) as never,
    )
    vi.mocked(paymentApi.update)
      .mockRejectedValueOnce(new Error('payment offline'))
      .mockResolvedValue(response({ id: 7 }) as never)
    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: '打开编辑' }))
    await waitFor(() => expect(numberInput()).toHaveValue('MANUAL-EXISTING'))
    fireEvent.change(numberInput(), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/收款金额/), { target: { value: '101' } })
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('alert')
    expect(projectApi.update).toHaveBeenNthCalledWith(
      1,
      42,
      expect.objectContaining({ contract_number: '' }),
    )
    expect(numberInput()).toHaveValue('20261122-02')
    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: '更新后的名称' } })
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByText('项目列表')
    expect(projectApi.update).toHaveBeenNthCalledWith(
      2,
      42,
      expect.objectContaining({ contract_number: '20261122-02', name: '更新后的名称' }),
    )
    expect(projectApi.generateContractNumber).not.toHaveBeenCalled()
  })

  it('does not show a generation error after leaving the form', async () => {
    const request = deferred<ReturnType<typeof numberResponse>>()
    vi.mocked(projectApi.generateContractNumber).mockReturnValue(request.promise as never)
    const { unmount } = render(<ProjectCreateView />)
    selectDate('2026-11-22')
    unmount()
    await act(async () => request.reject(new Error('offline')))
    expect(toasts.error).not.toHaveBeenCalled()
    expect(projectApi.generateContractNumber).toHaveBeenCalledOnce()
  })
})
