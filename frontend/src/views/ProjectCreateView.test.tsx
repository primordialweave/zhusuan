import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dictionaryApi, type DictionaryItem } from '@/api/dictionary'
import { paymentApi, projectApi, type Payment, type Project } from '@/api/project'
import { render } from '@/test/render'
import ProjectCreateView from './ProjectCreateView'

vi.mock('@/api/dictionary', () => ({ dictionaryApi: { getItems: vi.fn() } }))

vi.mock('@/api/project', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/project')>()
  return {
    ...original,
    paymentApi: {
      ...original.paymentApi,
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    projectApi: {
      ...original.projectApi,
      create: vi.fn(),
      get: vi.fn(),
      getPayments: vi.fn(),
      update: vi.fn(),
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
  type: 'software',
} satisfies Project

const payments = [
  {
    actual_date: '',
    amount: 30_000,
    id: 7,
    method: 'bank_transfer',
    percentage: 30,
    plan_date: '2026-08-01',
    project_id: 42,
    remark: '',
    stage: 'deposit',
    status: 'pending',
  },
  {
    actual_date: '',
    amount: 70_000,
    id: 8,
    method: 'bank_transfer',
    percentage: 70,
    plan_date: '2026-09-01',
    project_id: 42,
    remark: '',
    stage: 'final',
    status: 'pending',
  },
] satisfies Payment[]

const apiResponse = <T,>(data: T) => ({ data: { data } })

const projectTypes = [
  { dictionary_id: 4, id: 1, label: '医学研究', sort: 1, status: 1, value: 'medicine' },
  { dictionary_id: 4, id: 2, label: '软件开发', sort: 2, status: 1, value: 'software' },
] satisfies DictionaryItem[]

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function OpenOtherProject() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/projects/edit/43')} type="button">
      打开其他项目
    </button>
  )
}

function renderEditor() {
  return render(
    <Routes>
      <Route
        element={
          <>
            <OpenOtherProject />
            <ProjectCreateView />
          </>
        }
        path="/projects/edit/:id"
      />
    </Routes>,
    { initialEntries: ['/projects/edit/42'] },
  )
}

async function chooseDate(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  group?: HTMLElement,
) {
  const scope = group ? within(group) : screen
  await user.click(scope.getByRole('button', { name: label }))
  await user.click(
    document.querySelector<HTMLButtonElement>(
      '[data-slot="popover"] .ods-calendar__day:not(:disabled)',
    )!,
  )
}

async function fillNewProject(user: ReturnType<typeof userEvent.setup>) {
  // Fixture entry is not the behavior under test; avoid a rerender for every character.
  fireEvent.change(screen.getByRole('textbox', { name: /项目名称/ }), {
    target: { value: '新建合同项目' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /客户名称/ }), {
    target: { value: '新客户' },
  })
  await user.click(screen.getByRole('button', { name: '项目类型' }))
  await user.click(screen.getByRole('option', { name: '软件开发' }))
  await chooseDate(user, '开始日期')
  await chooseDate(user, '截止日期')
  await chooseDate(user, '合同日期')
  const total = screen.getByRole('spinbutton', { name: /合同总金额/ })
  fireEvent.change(total, { target: { value: '100000' } })
  await user.click(screen.getByRole('button', { name: '付款模式' }))
  await user.click(screen.getByRole('option', { name: '分期付款' }))
  const first = screen.getByRole('group', { name: '第 1 期收款' })
  fireEvent.change(within(first).getByRole('spinbutton', { name: /收款金额/ }), {
    target: { value: '30000' },
  })
  await chooseDate(user, '收款日期', first)
  await user.click(screen.getByRole('button', { name: '添加分期' }))
  const second = screen.getByRole('group', { name: '第 2 期收款' })
  fireEvent.change(within(second).getByRole('spinbutton', { name: /收款金额/ }), {
    target: { value: '70000' },
  })
  await chooseDate(user, '收款日期', second)
}

describe('ProjectCreateView design system migration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(dictionaryApi.getItems).mockResolvedValue(apiResponse(projectTypes) as never)
    vi.mocked(projectApi.get).mockResolvedValue(apiResponse(project) as never)
    vi.mocked(projectApi.getPayments).mockResolvedValue(apiResponse(payments) as never)
    vi.mocked(projectApi.create).mockResolvedValue(apiResponse(project) as never)
    vi.mocked(projectApi.update).mockResolvedValue(apiResponse(project) as never)
    vi.mocked(paymentApi.create).mockResolvedValue(apiResponse(payments[0]) as never)
    vi.mocked(paymentApi.delete).mockResolvedValue(apiResponse(null) as never)
    vi.mocked(paymentApi.update).mockResolvedValue(apiResponse(payments[0]) as never)
  })

  it('keeps the created project and successful installment IDs when retrying a partial new project save', async () => {
    const user = userEvent.setup()
    vi.mocked(paymentApi.create)
      .mockResolvedValueOnce(apiResponse(payments[0]) as never)
      .mockRejectedValueOnce(new Error('第二期保存失败'))
      .mockResolvedValueOnce(apiResponse(payments[1]) as never)
    render(
      <Routes>
        <Route element={<ProjectCreateView />} path="/projects/create" />
        <Route element={<h1>项目列表</h1>} path="/projects" />
      </Routes>,
      { initialEntries: ['/projects/create'] },
    )
    await fillNewProject(user)
    const second = screen.getByRole('group', { name: '第 2 期收款' })
    await user.click(within(second).getByRole('textbox', { name: '备注' }))
    await user.paste('保留未完成输入')
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('第 2 期收款未保存')
    expect(screen.getByRole('textbox', { name: /项目名称/ })).toHaveValue('新建合同项目')
    expect(within(second).getByRole('textbox', { name: '备注' })).toHaveValue('保留未完成输入')
    expect(projectApi.create).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目列表' })
    expect(projectApi.create).toHaveBeenCalledOnce()
    expect(projectApi.update).not.toHaveBeenCalled()
    expect(paymentApi.create).toHaveBeenCalledTimes(3)
    expect(vi.mocked(paymentApi.create).mock.calls.map(([payload]) => payload.amount)).toEqual([
      30000, 70000, 70000,
    ])
    expect(paymentApi.update).not.toHaveBeenCalled()
  }, 10_000)

  it('does not repeat acknowledged deletions or the saved project when a deletion is retried', async () => {
    const user = userEvent.setup()
    vi.mocked(projectApi.getPayments).mockResolvedValue(
      apiResponse([...payments, { ...payments[1], id: 9 }]) as never,
    )
    vi.mocked(paymentApi.delete)
      .mockResolvedValueOnce(apiResponse(null) as never)
      .mockRejectedValueOnce(new Error('第三期删除失败'))
      .mockResolvedValueOnce(apiResponse(null) as never)
    renderEditor()
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /项目名称/ })).toHaveValue(project.name),
    )
    await user.click(screen.getByRole('button', { name: '删除第 3 期' }))
    await user.click(screen.getByRole('button', { name: '删除第 2 期' }))
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('1 笔收款删除失败')
    expect(paymentApi.update).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    await waitFor(() => expect(paymentApi.update).toHaveBeenCalledOnce())
    expect(vi.mocked(paymentApi.delete).mock.calls.map(([id]) => id)).toEqual([8, 9, 9])
    expect(projectApi.update).toHaveBeenCalledOnce()
    expect(projectApi.create).not.toHaveBeenCalled()
  })

  it('preserves project input changed during creation and updates the created ID on the next save', async () => {
    const user = userEvent.setup()
    const creation = createDeferred<Awaited<ReturnType<typeof projectApi.create>>>()
    vi.mocked(projectApi.create).mockReturnValue(creation.promise)
    vi.mocked(paymentApi.create)
      .mockResolvedValueOnce(apiResponse(payments[0]) as never)
      .mockResolvedValueOnce(apiResponse(payments[1]) as never)
    render(
      <Routes>
        <Route element={<ProjectCreateView />} path="/projects/create" />
        <Route element={<h1>项目列表</h1>} path="/projects" />
      </Routes>,
      { initialEntries: ['/projects/create'] },
    )
    await fillNewProject(user)
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    await waitFor(() => expect(projectApi.create).toHaveBeenCalledOnce())
    const name = screen.getByRole('textbox', { name: /项目名称/ })
    await user.clear(name)
    await user.paste('创建期间的新名称')
    await act(async () => {
      creation.resolve(apiResponse(project) as never)
      await creation.promise
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('新修改尚未保存')
    expect(screen.getByRole('textbox', { name: /项目名称/ })).toHaveValue('创建期间的新名称')
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '项目列表' })
    expect(projectApi.create).toHaveBeenCalledOnce()
    expect(projectApi.update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ name: '创建期间的新名称' }),
    )
    expect(paymentApi.create).toHaveBeenCalledTimes(2)
    expect(paymentApi.update).not.toHaveBeenCalled()
  }, 10_000)

  it.each(['project', 'payments'])(
    'blocks editing save after a failed %s load and recovers on retry',
    async (failedRequest) => {
      const user = userEvent.setup()
      const failingApi = failedRequest === 'project' ? projectApi.get : projectApi.getPayments
      vi.mocked(failingApi).mockRejectedValueOnce(new Error('暂时不可用'))
      renderEditor()

      expect(await screen.findByRole('alert')).toHaveTextContent('项目详情加载失败')
      expect(screen.getByRole('button', { name: '确认保存' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: '确认保存' }))
      fireEvent.submit(screen.getByRole('form', { name: '项目编辑表单' }))
      expect(projectApi.update).not.toHaveBeenCalled()
      expect(paymentApi.update).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: '重试' }))
      await waitFor(() => expect(screen.getByLabelText(/项目名称/)).toHaveValue(project.name))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '确认保存' })).toBeEnabled()
      await user.click(screen.getByRole('button', { name: '确认保存' }))
      await waitFor(() =>
        expect(projectApi.update).toHaveBeenCalledWith(
          42,
          expect.objectContaining({
            description: project.description,
            payment_method: project.payment_method,
          }),
        ),
      )
      expect(paymentApi.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ amount: 30_000, status: 'pending' }),
      )
      expect(paymentApi.update).toHaveBeenCalledWith(
        8,
        expect.objectContaining({ amount: 70_000, status: 'pending' }),
      )
    },
  )

  it('never submits a previous project form when the next project failed to load', async () => {
    const user = userEvent.setup()
    vi.mocked(projectApi.get)
      .mockResolvedValueOnce(apiResponse(project) as never)
      .mockRejectedValueOnce(new Error('项目不存在'))
    renderEditor()
    await waitFor(() => expect(screen.getByLabelText(/项目名称/)).toHaveValue(project.name))

    await user.click(screen.getByRole('button', { name: '打开其他项目' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: '确认保存' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: '项目编辑表单' }))

    expect(projectApi.update).not.toHaveBeenCalled()
    expect(paymentApi.update).not.toHaveBeenCalled()
    expect(paymentApi.create).not.toHaveBeenCalled()
    expect(paymentApi.delete).not.toHaveBeenCalled()
  })

  it('fills a saved project type before its dictionary arrives, then uses the dictionary label', async () => {
    const user = userEvent.setup()
    const dictionary = createDeferred<Awaited<ReturnType<typeof dictionaryApi.getItems>>>()
    vi.mocked(dictionaryApi.getItems).mockReturnValue(dictionary.promise)
    vi.mocked(projectApi.get).mockResolvedValue(
      apiResponse({ ...project, type: 'medicine' }) as never,
    )

    renderEditor()
    await waitFor(() => expect(screen.getByLabelText(/项目名称/)).toHaveValue(project.name))
    expect(screen.getByRole('button', { name: '项目类型' })).toHaveTextContent('medicine')

    await act(async () => {
      dictionary.resolve(apiResponse(projectTypes) as never)
      await dictionary.promise
    })

    expect(dictionaryApi.getItems).toHaveBeenCalledWith('project_type')
    expect(screen.getByRole('button', { name: '项目类型' })).toHaveTextContent('医学研究')
    const summary = screen.getByRole('complementary', { name: '项目草稿摘要' })
    expect(within(summary).getByText('医学研究')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '项目类型' }))
    expect(screen.getByRole('option', { name: '医学研究' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it.each(['missing', 'unavailable'])(
    'preserves a saved type and confirmed payment when the dictionary is %s',
    async (dictionaryState) => {
      const user = userEvent.setup()
      if (dictionaryState === 'unavailable') {
        vi.mocked(dictionaryApi.getItems).mockRejectedValue(new Error('字典不可用'))
      }
      vi.mocked(projectApi.get).mockResolvedValue(
        apiResponse({ ...project, type: 'legacy_type' }) as never,
      )
      vi.mocked(projectApi.getPayments).mockResolvedValue(
        apiResponse([{ ...payments[0], status: 'confirmed' }]) as never,
      )

      renderEditor()
      await waitFor(() => expect(screen.getByLabelText(/项目名称/)).toHaveValue(project.name))
      expect(screen.getByRole('button', { name: '项目类型' })).toHaveTextContent('legacy_type')
      expect(screen.getByRole('button', { name: '状态' })).toHaveTextContent('已收款')
      await user.click(screen.getByRole('button', { name: '确认保存' }))

      await waitFor(() => {
        expect(projectApi.update).toHaveBeenCalledWith(
          42,
          expect.objectContaining({ type: 'legacy_type' }),
        )
        expect(paymentApi.update).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ status: 'confirmed' }),
        )
      })
    },
  )

  it('builds the project form from ODS fields and form patterns', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Routes>
        <Route element={<ProjectCreateView />} path="/projects/create" />
      </Routes>,
      { initialEntries: ['/projects/create'] },
    )

    expect(screen.getByRole('heading', { name: '创建项目' })).toBeInTheDocument()
    expect(container.querySelectorAll('.ods-form-section').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll('.ods-form-grid').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelector('.ods-form-actions')).toBeInTheDocument()
    expect(container.querySelector('.project-compose-layout')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '项目草稿摘要' })).toBeInTheDocument()
    // Flat page: no English kickers, no step counters, nothing framed in a filled card.
    expect(container.textContent).not.toMatch(/PROJECT|STEP \d/)
    expect(container.querySelector('.ods-page-header__eyebrow')).toBeNull()
    expect(
      Array.from(container.querySelectorAll('.ods-card')).map((card) =>
        card.getAttribute('data-variant'),
      ),
    ).toEqual(['transparent', 'transparent'])
    expect(screen.getByText('档案完整度')).toBeInTheDocument()
    expect(screen.getByText('计划金额')).toBeInTheDocument()
    expect(screen.getByLabelText(/项目名称/)).toHaveClass('ods-input')
    expect(screen.getByLabelText(/合同总金额/)).toHaveClass('ods-number-input__field')

    await user.click(screen.getByRole('button', { name: '付款模式' }))
    await user.click(screen.getByRole('option', { name: '分期付款' }))
    expect(screen.getByRole('button', { name: '添加分期' })).toBeInTheDocument()
  })

  it('keeps a newer project load pending and ignores an older response and finally block', async () => {
    const user = userEvent.setup()
    const oldProject = createDeferred<Awaited<ReturnType<typeof projectApi.get>>>()
    const oldPayments = createDeferred<Awaited<ReturnType<typeof projectApi.getPayments>>>()
    const nextProjectRequest = createDeferred<Awaited<ReturnType<typeof projectApi.get>>>()
    const nextPaymentsRequest = createDeferred<Awaited<ReturnType<typeof projectApi.getPayments>>>()
    const nextProject = { ...project, company: '新客户', id: 43, name: '新项目' }

    vi.mocked(projectApi.get).mockImplementation((projectId) =>
      projectId === 42 ? oldProject.promise : nextProjectRequest.promise,
    )
    vi.mocked(projectApi.getPayments).mockImplementation((projectId) =>
      projectId === 42 ? oldPayments.promise : nextPaymentsRequest.promise,
    )

    renderEditor()
    await waitFor(() => expect(projectApi.get).toHaveBeenCalledWith(42))
    await user.click(screen.getByRole('button', { name: '打开其他项目' }))
    await waitFor(() => expect(projectApi.get).toHaveBeenCalledWith(43))

    await act(async () => {
      oldProject.resolve(apiResponse(project) as never)
      oldPayments.resolve(apiResponse(payments) as never)
      await Promise.all([oldProject.promise, oldPayments.promise])
    })
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled()

    await act(async () => {
      nextProjectRequest.resolve(apiResponse(nextProject) as never)
      nextPaymentsRequest.resolve(apiResponse([]) as never)
      await Promise.all([nextProjectRequest.promise, nextPaymentsRequest.promise])
    })

    await waitFor(() => expect(screen.getByLabelText(/项目名称/)).toHaveValue('新项目'))
    expect(screen.getByRole('button', { name: '确认保存' })).toBeEnabled()
  })

  it('finishes deletions before launching payment updates and creates in parallel', async () => {
    const user = userEvent.setup()
    const deletion = createDeferred<Awaited<ReturnType<typeof paymentApi.delete>>>()
    const update = createDeferred<Awaited<ReturnType<typeof paymentApi.update>>>()
    const creation = createDeferred<Awaited<ReturnType<typeof paymentApi.create>>>()

    vi.mocked(paymentApi.delete).mockReturnValue(deletion.promise)
    vi.mocked(paymentApi.update).mockReturnValue(update.promise)
    vi.mocked(paymentApi.create).mockReturnValue(creation.promise)

    renderEditor()
    await waitFor(() => expect(screen.getByLabelText(/项目名称/)).toHaveValue('星轨项目'))

    await user.click(screen.getByRole('button', { name: '添加分期' }))
    const addedPayment = screen.getByRole('group', { name: '第 3 期收款' })
    await user.type(within(addedPayment).getByRole('spinbutton', { name: /收款金额/ }), '5000')
    await user.click(within(addedPayment).getByRole('button', { name: /收款日期/ }))
    const availableDate = document.querySelector<HTMLButtonElement>(
      '[data-slot="popover"] .ods-calendar__day:not(:disabled)',
    )
    expect(availableDate).not.toBeNull()
    await user.click(availableDate!)
    await user.click(screen.getByRole('button', { name: '删除第 2 期' }))
    await user.click(screen.getByRole('button', { name: '确认保存' }))

    await waitFor(() => expect(paymentApi.delete).toHaveBeenCalledWith(8))
    expect(paymentApi.update).not.toHaveBeenCalled()
    expect(paymentApi.create).not.toHaveBeenCalled()

    await act(async () => {
      deletion.resolve(apiResponse(null) as never)
      await deletion.promise
    })
    await waitFor(() => {
      expect(paymentApi.update).toHaveBeenCalledTimes(1)
      expect(paymentApi.create).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      update.resolve(apiResponse(payments[0]) as never)
      creation.resolve(apiResponse(payments[0]) as never)
      await Promise.all([update.promise, creation.promise])
    })
  })
})
