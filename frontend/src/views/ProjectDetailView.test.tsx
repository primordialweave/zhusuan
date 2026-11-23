import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dictionaryApi, type DictionaryItem } from '@/api/dictionary'
import { paymentApi, projectApi, type Payment, type Project } from '@/api/project'
import { render } from '@/test/render'
import ProjectDetailView from './ProjectDetailView'

vi.mock('@/api/dictionary', () => ({ dictionaryApi: { getItems: vi.fn() } }))

vi.mock('@/api/project', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/project')>()
  return {
    ...original,
    paymentApi: {
      ...original.paymentApi,
      confirm: vi.fn(),
    },
    projectApi: {
      ...original.projectApi,
      get: vi.fn(),
      getPayments: vi.fn(),
    },
  }
})

const project = {
  company: '橙子科技',
  contract_date: '2026-07-01',
  contract_number: 'ORANGE-001',
  create_time: '2026-07-01',
  description: '未来感品牌升级',
  end_date: '2026-09-30',
  id: 42,
  name: '星轨项目',
  payment_method: '分期付款',
  received_amount: 20_000,
  start_date: '2026-07-01',
  status: 'active',
  total_amount: 100_000,
  type: '品牌设计',
} satisfies Project

const payment = {
  actual_date: '',
  amount: 30_000,
  id: 7,
  method: 'bank_transfer',
  percentage: 30,
  plan_date: '2026-08-01',
  project_id: 42,
  remark: '',
  stage: '中期款',
  status: 'pending',
} satisfies Payment

const laterPayment = { ...payment, id: 8, stage: '尾款' } satisfies Payment

const apiResponse = <T,>(data: T) => ({ data: { data } })

const projectTypes = [
  { dictionary_id: 4, id: 1, label: '医学研究', sort: 1, status: 1, value: 'medicine' },
  { dictionary_id: 4, id: 2, label: '网页应用开发', sort: 2, status: 1, value: 'web' },
] satisfies DictionaryItem[]

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function OpenPaymentDeepLink() {
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => navigate('/projects/42?tab=payments&payment=8')} type="button">
        打开收款深链
      </button>
      <button onClick={() => navigate('/projects/43')} type="button">
        打开其他项目
      </button>
    </>
  )
}

function renderProjectDetail(initialEntry: string) {
  return render(
    <Routes>
      <Route
        element={
          <>
            <OpenPaymentDeepLink />
            <ProjectDetailView />
          </>
        }
        path="/projects/:id"
      />
      <Route element={<h1>编辑项目收款</h1>} path="/projects/edit/:id" />
    </Routes>,
    { initialEntries: [initialEntry] },
  )
}

describe('ProjectDetailView payment deep links', () => {
  it.each(['abc', '0', '-1', '9007199254740993'])(
    'ends invalid deep-link loading without requesting project %s',
    async (id) => {
      renderProjectDetail(`/projects/${id}`)
      expect(await screen.findByRole('alert')).toHaveTextContent('项目地址无效')
      expect(projectApi.get).not.toHaveBeenCalled()
      expect(projectApi.getPayments).not.toHaveBeenCalled()
      expect(screen.queryByRole('status', { name: '正在加载项目详情' })).not.toBeInTheDocument()
    },
  )
  it('keeps the page in a skeleton state until both the project and payment plan arrive', async () => {
    const pending = createDeferred<Awaited<ReturnType<typeof projectApi.get>>>()
    vi.mocked(projectApi.get).mockReturnValue(pending.promise)
    const { container } = renderProjectDetail('/projects/42')

    expect(screen.getByRole('status', { name: '正在加载项目详情' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByText('¥100,000.00')).not.toBeInTheDocument()
    await waitFor(() => expect(projectApi.get).toHaveBeenCalledWith(42))

    await act(async () => {
      pending.resolve(apiResponse(project) as never)
      await pending.promise
    })
    expect(await screen.findByRole('heading', { name: '星轨项目' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载项目详情' })).not.toBeInTheDocument()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dictionaryApi.getItems).mockResolvedValue(apiResponse(projectTypes) as never)
    vi.mocked(projectApi.get).mockResolvedValue(apiResponse(project) as never)
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      apiResponse([payment, laterPayment]) as never,
    )
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => undefined)
  })

  it('numbers the earliest actual receipt first even when API and planned dates disagree', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      apiResponse([
        {
          ...laterPayment,
          amount: 200,
          status: 'confirmed',
          actual_date: '2026-11-21T00:00:00Z',
          plan_date: '2026-01-01',
        },
        {
          ...payment,
          amount: 100,
          status: 'confirmed',
          actual_date: '2026-10-16T23:00:00-12:00',
          plan_date: '2026-12-31',
        },
      ]) as never,
    )
    renderProjectDetail('/projects/42?tab=payments')
    const first = await screen.findByTestId('payment-7')
    const second = screen.getByTestId('payment-8')
    expect(
      [...document.querySelectorAll('[data-payment-id]')].map((row) =>
        row.getAttribute('data-payment-id'),
      ),
    ).toEqual(['7', '8'])
    expect(within(first).getByText('01')).toBeInTheDocument()
    expect(within(second).getByText('02')).toBeInTheDocument()
    expect(first).toHaveTextContent('实际到账：2026-10-16')
  })

  it('uses the highest ID as the latest receipt when actual calendar dates are equal', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      apiResponse([
        { ...payment, amount: 100, status: 'confirmed', actual_date: '2026-11-21T00:00:00+14:00' },
        { ...laterPayment, amount: 200, status: 'confirmed', actual_date: '2026-11-21T00:00:00Z' },
      ]) as never,
    )
    renderProjectDetail('/projects/42')
    const recent = await screen.findByText('最近收款')
    expect(recent.closest('.ods-card')).toHaveTextContent('¥200.00')
  })

  it('shows received amounts on their actual calendar dates and retains legacy plans as history', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      apiResponse([
        {
          ...payment,
          status: 'confirmed',
          stage: 'receipt',
          actual_date: '2026-11-21T00:00:00+14:00',
          plan_date: '2026-12-31T00:00:00Z',
        },
        { ...laterPayment, status: 'overdue', actual_date: '', plan_date: '2026-08-01' },
      ]) as never,
    )
    renderProjectDetail('/projects/42?tab=payments')
    const received = await screen.findByTestId('payment-7')
    expect(received).toHaveTextContent('实际到账：2026-11-21')
    expect(received).not.toHaveTextContent('2026-12-31')
    expect(received).toHaveTextContent('收款')
    expect(received).toHaveTextContent('银行转账')
    expect(screen.getByTestId('payment-8')).toHaveTextContent('历史计划日期：2026-08-01')
    expect(screen.getByTestId('payment-8')).toHaveTextContent('已逾期')
    expect(paymentApi.confirm).not.toHaveBeenCalled()
  })

  it('does not invent an actual receipt date from a settled legacy plan', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      apiResponse([{ ...payment, status: 'confirmed', actual_date: null }]) as never,
    )
    renderProjectDetail('/projects/42?tab=payments')
    const received = await screen.findByTestId('payment-7')
    expect(received).toHaveTextContent('实际到账：日期未记录')
    expect(received).not.toHaveTextContent('2026-08-01')
  })

  it('shows the latest receipt instead of the next historical plan without completing the project', async () => {
    vi.mocked(projectApi.get).mockResolvedValue(
      apiResponse({ ...project, received_amount: 100_000 }) as never,
    )
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      apiResponse([
        { ...payment, status: 'pending', plan_date: '2026-12-31' },
        {
          ...laterPayment,
          status: 'confirmed',
          actual_date: '2026-11-21T00:00:00+14:00',
          plan_date: '2026-08-01',
        },
      ]) as never,
    )
    const { container } = renderProjectDetail('/projects/42')
    await screen.findByRole('heading', { name: '最近收款' })
    const latest = container.querySelector('.project-next-payment-card')!
    expect(latest).toHaveTextContent('2026-11-21')
    expect(latest).not.toHaveTextContent('2026-12-31')
    expect(screen.getByText('进行中')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '回款完成度' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
    expect(container.querySelector('.project-runway__track > li:last-child')).not.toHaveAttribute(
      'data-reached',
      'true',
    )
  })

  it('opens editing to register a historical receipt without confirming it automatically', async () => {
    const user = userEvent.setup()
    renderProjectDetail('/projects/42?tab=payments&payment=7')
    const historical = await screen.findByTestId('payment-7')
    await user.click(within(historical).getByRole('link', { name: '中期款：登记到账' }))
    expect(await screen.findByRole('heading', { name: '编辑项目收款' })).toBeInTheDocument()
    expect(paymentApi.confirm).not.toHaveBeenCalled()
  })

  it('offers receipt entry when no actual receipts or historical plans exist', async () => {
    vi.mocked(projectApi.getPayments).mockResolvedValue(apiResponse([]) as never)
    renderProjectDetail('/projects/42?tab=payments')
    expect(await screen.findByText('暂无收款记录')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '录入收款' })).toHaveLength(2)
    expect(screen.queryByText('暂无收款计划')).not.toBeInTheDocument()
  })

  it.each(['project', 'payments'])(
    'retries after a failed %s load instead of loading forever',
    async (failedRequest) => {
      const user = userEvent.setup()
      const failingApi = failedRequest === 'project' ? projectApi.get : projectApi.getPayments
      vi.mocked(failingApi).mockRejectedValueOnce(new Error('暂时不可用'))
      renderProjectDetail('/projects/42')

      expect(await screen.findByRole('alert')).toHaveTextContent('项目详情加载失败')
      expect(screen.queryByLabelText('正在加载项目详情')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '重试' }))

      expect(await screen.findByRole('heading', { name: project.name })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(projectApi.get).toHaveBeenCalledTimes(2)
      expect(projectApi.getPayments).toHaveBeenCalledTimes(2)
    },
  )

  it('does not show an old project failure on a newer route', async () => {
    const user = userEvent.setup()
    let rejectOldProject!: (reason: Error) => void
    const oldProject = new Promise((_, reject) => {
      rejectOldProject = reject
    })
    vi.mocked(projectApi.get)
      .mockReturnValueOnce(oldProject as never)
      .mockResolvedValue(apiResponse({ ...project, id: 43, name: '新项目' }) as never)
    renderProjectDetail('/projects/42')
    await waitFor(() => expect(projectApi.get).toHaveBeenCalledWith(42))
    await user.click(screen.getByRole('button', { name: '打开其他项目' }))
    await screen.findByRole('heading', { name: '新项目' })

    await act(async () => {
      rejectOldProject(new Error('旧项目加载失败'))
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '新项目' })).toBeInTheDocument()
  })

  it('updates a saved project type to its dictionary name when the dictionary arrives', async () => {
    const dictionary = createDeferred<Awaited<ReturnType<typeof dictionaryApi.getItems>>>()
    vi.mocked(dictionaryApi.getItems).mockReturnValue(dictionary.promise)
    vi.mocked(projectApi.get).mockResolvedValue(
      apiResponse({ ...project, type: 'medicine' }) as never,
    )
    renderProjectDetail('/projects/42')

    expect(await screen.findByRole('heading', { name: project.name })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '正在加载项目类型' })).toBeInTheDocument()
    expect(screen.queryByText('medicine')).not.toBeInTheDocument()

    await act(async () => {
      dictionary.resolve(apiResponse(projectTypes) as never)
      await dictionary.promise
    })

    expect(dictionaryApi.getItems).toHaveBeenCalledWith('project_type')
    expect(screen.getByText('医学研究')).toBeInTheDocument()
    expect(screen.queryByText('medicine')).not.toBeInTheDocument()
  })

  it('uses the configured name rather than a hardcoded default name', async () => {
    vi.mocked(projectApi.get).mockResolvedValue(apiResponse({ ...project, type: 'web' }) as never)
    renderProjectDetail('/projects/42')

    expect(await screen.findByText('网页应用开发')).toBeInTheDocument()
    expect(screen.queryByText('Web开发')).not.toBeInTheDocument()
  })

  it('matches a late dictionary response to the current project after navigation', async () => {
    const user = userEvent.setup()
    const dictionary = createDeferred<Awaited<ReturnType<typeof dictionaryApi.getItems>>>()
    vi.mocked(dictionaryApi.getItems).mockReturnValue(dictionary.promise)
    vi.mocked(projectApi.get).mockImplementation((projectId) =>
      Promise.resolve(
        apiResponse({
          ...project,
          id: projectId,
          name: projectId === 42 ? project.name : '新项目',
          type: projectId === 42 ? 'medicine' : 'web',
        }) as never,
      ),
    )
    renderProjectDetail('/projects/42')

    await screen.findByRole('heading', { name: project.name })
    await user.click(screen.getByRole('button', { name: '打开其他项目' }))
    await screen.findByRole('heading', { name: '新项目' })

    await act(async () => {
      dictionary.resolve(apiResponse(projectTypes) as never)
      await dictionary.promise
    })

    expect(screen.getByText('网页应用开发')).toBeInTheDocument()
    expect(screen.queryByText('医学研究')).not.toBeInTheDocument()
  })

  it.each([
    ['software', '软件开发'],
    ['web', 'Web开发'],
    ['legacy_type', 'legacy_type'],
    ['品牌设计', '品牌设计'],
    ['', '-'],
  ])('keeps project information visible when the dictionary fails for %s', async (type, label) => {
    vi.mocked(dictionaryApi.getItems).mockRejectedValue(new Error('字典不可用'))
    vi.mocked(projectApi.get).mockResolvedValue(apiResponse({ ...project, type }) as never)
    const { container } = renderProjectDetail('/projects/42')

    await screen.findByRole('heading', { name: project.name })
    const typeRow = container.querySelector('.project-record-list > div:first-child')
    expect(typeRow?.querySelector('dd')).toHaveTextContent(label)
  })

  it('preserves an unknown type when its dictionary item was removed', async () => {
    vi.mocked(projectApi.get).mockResolvedValue(
      apiResponse({ ...project, type: 'legacy_type' }) as never,
    )
    renderProjectDetail('/projects/42')

    expect(await screen.findByText('legacy_type')).toBeInTheDocument()
  })

  it('opens the receipt records tab from the initial search params', async () => {
    renderProjectDetail('/projects/42?tab=payments&payment=7')

    await screen.findByRole('heading', { name: '收款记录' })
    expect(screen.getByRole('tab', { name: '收款记录' })).toHaveClass('active')
    expect(screen.getByText('中期款')).toBeInTheDocument()
  })

  it('gives icon-only project controls explicit accessible labels', async () => {
    const { container } = renderProjectDetail('/projects/42')

    await waitFor(() => expect(screen.getByText('回款完成度')).toBeInTheDocument())
    expect(container.querySelector('.project-settlement-board')).toBeInTheDocument()
    expect(container.querySelector('.project-runway')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '项目档案' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '最近收款' })).toBeInTheDocument()
    expect(screen.getByText('¥80,000.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回项目列表' })).toHaveAttribute(
      'aria-label',
      '返回项目列表',
    )
    expect(screen.getByRole('button', { name: '编辑项目' })).toHaveAttribute(
      'aria-label',
      '编辑项目',
    )
    expect(screen.getByRole('button', { name: '导出项目：星轨项目' })).toHaveAttribute(
      'aria-label',
      '导出项目：星轨项目',
    )
  })

  it('switches to receipt records when search params change', async () => {
    const user = userEvent.setup()
    renderProjectDetail('/projects/42')

    await waitFor(() => expect(screen.getByText('回款完成度')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: '项目概览' })).toHaveClass('active')

    await user.click(screen.getByRole('button', { name: '打开收款深链' }))

    expect(await screen.findByRole('heading', { name: '收款记录' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '收款记录' })).toHaveClass('active')
  })

  it('highlights, scrolls to, and focuses the requested payment after loading', async () => {
    renderProjectDetail('/projects/42?tab=payments&payment=7')

    const target = await screen.findByTestId('payment-7')
    await waitFor(() => expect(target).toHaveAttribute('data-tone', 'accent'))
    expect(target).toHaveAttribute('data-orientation', 'horizontal')
    expect(target.querySelector('.payment-icon')).toHaveAttribute('data-radius', 'pill')
    expect(target.querySelector('.payment-icon')).toHaveAttribute('data-tone', 'accent')
    expect(target).toHaveAttribute('id', 'payment-7')
    expect(target).toHaveAttribute('tabindex', '-1')
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('repositions when the requested payment changes without reloading payments', async () => {
    const user = userEvent.setup()
    renderProjectDetail('/projects/42?tab=payments&payment=7')

    await waitFor(() =>
      expect(screen.getByTestId('payment-7')).toHaveAttribute('data-tone', 'accent'),
    )
    await user.click(screen.getByRole('button', { name: '打开收款深链' }))

    await waitFor(() =>
      expect(screen.getByTestId('payment-8')).toHaveAttribute('data-tone', 'accent'),
    )
    expect(screen.getByTestId('payment-7')).toHaveAttribute('data-tone', 'neutral')
    expect(projectApi.getPayments).toHaveBeenCalledTimes(1)
  })

  it('does not steal focus again when opening the same receipt deep link', async () => {
    const user = userEvent.setup()
    renderProjectDetail('/projects/42?tab=payments&payment=8')

    const target = await screen.findByTestId('payment-8')
    await waitFor(() => expect(target.scrollIntoView).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: '打开收款深链' }))
    expect(projectApi.getPayments).toHaveBeenCalledOnce()

    expect(target.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(target.focus).mock.contexts.filter((context) => context === target),
    ).toHaveLength(1)
  })

  it('does not throw when the requested payment is absent or scrolling APIs are unavailable', async () => {
    delete (Element.prototype as Partial<Element>).scrollIntoView
    renderProjectDetail('/projects/42?tab=payments&payment=999')

    await screen.findByRole('heading', { name: '收款记录' })
    expect(screen.queryByTestId('payment-999')).not.toBeInTheDocument()
  })

  it('does not let an older project request overwrite a newer route parameter', async () => {
    const user = userEvent.setup()
    const oldProject = createDeferred<Awaited<ReturnType<typeof projectApi.get>>>()
    const oldPayments = createDeferred<Awaited<ReturnType<typeof projectApi.getPayments>>>()
    const nextProject = { ...project, company: '新客户', id: 43, name: '新项目' }

    vi.mocked(projectApi.get).mockImplementation((projectId) =>
      projectId === 42 ? oldProject.promise : Promise.resolve(apiResponse(nextProject) as never),
    )
    vi.mocked(projectApi.getPayments).mockImplementation((projectId) =>
      projectId === 42 ? oldPayments.promise : Promise.resolve(apiResponse([]) as never),
    )

    renderProjectDetail('/projects/42')
    await waitFor(() => expect(projectApi.get).toHaveBeenCalledWith(42))
    await user.click(screen.getByRole('button', { name: '打开其他项目' }))

    expect(await screen.findByRole('heading', { name: '新项目' })).toBeInTheDocument()

    await act(async () => {
      oldProject.resolve(apiResponse(project) as never)
      oldPayments.resolve(apiResponse([payment]) as never)
      await Promise.all([oldProject.promise, oldPayments.promise])
    })

    expect(screen.getByRole('heading', { name: '新项目' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '星轨项目' })).not.toBeInTheDocument()
  })
})
