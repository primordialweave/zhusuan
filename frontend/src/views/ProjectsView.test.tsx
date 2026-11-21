import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { projectApi, type Project } from '@/api/project'
import { useToastStore } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { render } from '@/test/render'
import ProjectsView from './ProjectsView'

vi.mock('@/api/project', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/project')>()
  return {
    ...original,
    projectApi: {
      ...original.projectApi,
      archive: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    },
  }
})

const project: Project = {
  company: '橙子科技',
  contract_date: '2026-07-01',
  contract_number: 'ORANGE-001',
  create_time: '2026-07-01',
  description: '项目说明',
  end_date: '2026-09-30',
  id: 42,
  name: '星轨项目',
  payment_method: '分期付款',
  received_amount: 20_000,
  start_date: '2026-07-01',
  status: 'active',
  total_amount: 100_000,
  type: 'software',
}

const listResponse = {
  data: {
    data: {
      list: [project],
      page: 1,
      page_size: 10,
      total: 1,
      total_pages: 1,
    },
  },
}

const originalToastError = useToastStore.getState().error

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function LocationProbe() {
  return <output aria-label="当前位置">{useLocation().pathname}</output>
}

describe('ProjectsView design system migration', () => {
  it('hides old rows and pagination counts while a new filter is waiting', async () => {
    const user = userEvent.setup()
    const next = createDeferred<typeof listResponse>()
    vi.mocked(projectApi.list).mockImplementation((params) =>
      params?.status ? (next.promise as never) : (Promise.resolve(listResponse) as never),
    )
    const { container } = render(<ProjectsView />, { initialEntries: ['/projects'] })
    await screen.findByText('星轨项目')
    expect(screen.getByText('显示 1-1 条，共 1 条')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '项目状态筛选' }))
    await user.click(screen.getByRole('option', { name: '已完成' }))
    await screen.findByRole('status', { name: '正在加载项目列表' })
    expect(screen.queryByText('星轨项目')).not.toBeInTheDocument()
    expect(screen.queryByText('显示 1-1 条，共 1 条')).not.toBeInTheDocument()
    expect(container.querySelector('.projects-loading-pagination')).toBeInTheDocument()

    await act(async () => {
      next.resolve({
        data: {
          data: {
            ...listResponse.data.data,
            list: [{ ...project, name: '完成项目', status: 'completed' }],
          },
        },
      })
      await next.promise
    })
    expect(await screen.findByText('完成项目')).toBeInTheDocument()
    expect(screen.queryByText('星轨项目')).not.toBeInTheDocument()

    await user.click(screen.getByRole('searchbox', { name: '搜索项目' }))
    await user.keyboard('{Enter}')
    expect(projectApi.list).toHaveBeenCalledTimes(2)
    expect(screen.getByText('完成项目')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载项目列表' })).not.toBeInTheDocument()
  })

  it('ends skeleton waiting with an error instead of exposing old-query rows after a failed filter', async () => {
    const user = userEvent.setup()
    const next = createDeferred<typeof listResponse>()
    vi.mocked(projectApi.list).mockImplementation((params) =>
      params?.status ? (next.promise as never) : (Promise.resolve(listResponse) as never),
    )
    const { container } = render(<ProjectsView />, { initialEntries: ['/projects'] })
    await screen.findByText('星轨项目')
    await user.click(screen.getByRole('button', { name: '项目状态筛选' }))
    await user.click(screen.getByRole('option', { name: '已完成' }))
    await screen.findByRole('status', { name: '正在加载项目列表' })

    await act(async () => {
      next.reject(new Error('offline'))
      await next.promise.catch(() => undefined)
    })
    expect(await screen.findByText('项目列表加载失败')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试项目列表' })).toBeInTheDocument()
    expect(screen.queryByText('星轨项目')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载项目列表' })).not.toBeInTheDocument()
    expect(container.querySelector('.projects-loading-pagination')).not.toBeInTheDocument()
  })

  it('replaces a loaded empty list with skeletons while a new filter is waiting', async () => {
    const user = userEvent.setup()
    const next = createDeferred<typeof listResponse>()
    vi.mocked(projectApi.list).mockImplementation((params) =>
      params?.status
        ? (next.promise as never)
        : (Promise.resolve({
            data: { data: { ...listResponse.data.data, list: [], total: 0 } },
          }) as never),
    )
    const { container } = render(<ProjectsView />, { initialEntries: ['/projects'] })
    await screen.findByText('还没有项目')

    await user.click(screen.getByRole('button', { name: '项目状态筛选' }))
    await user.click(screen.getByRole('option', { name: '进行中' }))
    await screen.findByRole('status', { name: '正在加载项目列表' })
    expect(screen.queryByText('没有符合条件的项目')).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()

    await act(async () => {
      next.resolve(listResponse)
      await next.promise
    })
    expect(await screen.findByText('星轨项目')).toBeInTheDocument()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null })
    useToastStore.setState({ error: vi.fn(() => 1) })
    vi.mocked(projectApi.list).mockResolvedValue(listResponse as never)
  })

  afterEach(() => {
    useToastStore.setState({ error: originalToastError })
  })

  it('renders the project workflow from Orange Design System components', async () => {
    const { container } = render(<ProjectsView />, { initialEntries: ['/projects'] })

    await waitFor(() => expect(screen.getByText('星轨项目')).toBeInTheDocument())
    expect(container.querySelector('.ods-search-field')).toBeInTheDocument()
    expect(container.querySelector('.ods-table')).toBeInTheDocument()
    expect(container.querySelector('.ods-progress')).toBeInTheDocument()
    expect(container.querySelector('.ods-chip')).toBeInTheDocument()
    expect(container.querySelector('.ods-table')).toHaveAttribute('data-variant', 'plain')
    expect(screen.getByRole('button', { name: '项目状态筛选' })).toHaveTextContent('全部状态')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(container.querySelector('.ods-summary-metric')).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="eyebrow"]')).not.toBeInTheDocument()
    expect(document.querySelector('.ods-page-header__description, .scene-page__text')).toBeNull()
    expect(screen.getAllByRole('columnheader').map((column) => column.textContent)).toEqual([
      '项目名称',
      '客户',
      '截止日期',
      '合同金额',
      '已收款',
      '收款进度',
      '状态',
      '操作',
    ])
    expect(screen.getByRole('cell', { name: '橙子科技' })).toBeInTheDocument()
    expect(screen.getByText('¥20,000 / ¥100,000')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '星轨项目 收款进度' })).toHaveAttribute(
      'aria-valuetext',
      '20%',
    )
    expect(container.querySelector('.ods-pagination-bar')).toHaveAttribute('data-layout', 'split')
    expect(screen.getByRole('button', { name: '每页条数' })).toHaveAttribute(
      'data-width',
      'content',
    )
    expect(screen.getByRole('link', { name: /新建项目/ })).toHaveClass('ods-router-button')
    expect(screen.getByRole('link', { name: '星轨项目' })).toHaveClass('ods-router-link')
  })

  it('uses a real project-name link without giving the row button semantics', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ProjectsView />
        <LocationProbe />
      </>,
      { initialEntries: ['/projects'] },
    )

    const projectLink = await screen.findByRole('link', { name: '星轨项目' })
    const row = projectLink.closest('tr')
    expect(projectLink).toHaveAttribute('href', '/projects/42')
    expect(row).not.toHaveAttribute('tabindex')

    await user.click(projectLink)
    expect(screen.getByLabelText('当前位置')).toHaveTextContent('/projects/42')
  })

  it('uses an ODS alert dialog before deleting a project', async () => {
    const user = userEvent.setup()
    render(<ProjectsView />, { initialEntries: ['/projects'] })

    await waitFor(() => expect(screen.getByText('星轨项目')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '星轨项目：项目操作' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '编辑项目',
      '添加收款',
      '导出项目',
      '归档项目',
      '删除项目',
    ])
    await user.click(screen.getByRole('menuitem', { name: '删除项目' }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('删除项目？')).toBeInTheDocument()
    expect(projectApi.delete).not.toHaveBeenCalled()
  })

  it('does not activate project navigation when a nested action receives Enter', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ProjectsView />
        <LocationProbe />
      </>,
      { initialEntries: ['/projects'] },
    )

    const menuButton = await screen.findByRole('button', { name: '星轨项目：项目操作' })
    menuButton.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByLabelText('当前位置')).toHaveTextContent('/projects')
    expect(screen.getByRole('menu', { name: '星轨项目 的操作' })).toBeInTheDocument()
  })

  it('ignores a deferred rejection from an older list request', async () => {
    const user = userEvent.setup()
    const firstRequest = createDeferred<unknown>()
    const secondRequest = createDeferred<unknown>()
    const toastError = vi.mocked(useToastStore.getState().error)
    vi.mocked(projectApi.list)
      .mockReturnValueOnce(firstRequest.promise as never)
      .mockReturnValueOnce(secondRequest.promise as never)

    render(<ProjectsView />, { initialEntries: ['/projects'] })
    await waitFor(() => expect(projectApi.list).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: '项目状态筛选' }))
    await user.click(screen.getByRole('option', { name: '进行中' }))
    await waitFor(() => expect(projectApi.list).toHaveBeenCalledTimes(2))
    expect(projectApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, status: 'active' }),
    )

    await act(async () => {
      firstRequest.reject(new Error('旧请求失败'))
      await Promise.resolve()
    })

    expect(toastError).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await act(async () => {
      secondRequest.resolve(listResponse)
      await Promise.resolve()
    })
    expect(await screen.findByText('星轨项目')).toBeInTheDocument()
  })

  it('does not consume responses or report errors from issued requests after unmount', async () => {
    const completedRequest = createDeferred<unknown>()
    const failedRequest = createDeferred<unknown>()
    const readPayload = vi.fn()
    const toastError = vi.mocked(useToastStore.getState().error)
    vi.mocked(projectApi.list)
      .mockReturnValueOnce(completedRequest.promise as never)
      .mockReturnValueOnce(failedRequest.promise as never)

    const completedView = render(<ProjectsView />, { initialEntries: ['/projects'] })
    const failedView = render(<ProjectsView />, { initialEntries: ['/projects'] })
    await waitFor(() => expect(projectApi.list).toHaveBeenCalledTimes(2))
    completedView.unmount()
    failedView.unmount()

    await act(async () => {
      completedRequest.resolve({
        get data() {
          readPayload()
          return listResponse.data
        },
      })
      failedRequest.reject(new Error('卸载后失败'))
      await Promise.resolve()
    })

    expect(readPayload).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('shows an ODS error state instead of zero data and retries the list request', async () => {
    const user = userEvent.setup()
    const toastError = vi.mocked(useToastStore.getState().error)
    vi.mocked(projectApi.list).mockRejectedValueOnce(new Error('首次加载失败'))

    render(<ProjectsView />, { initialEntries: ['/projects'] })

    expect(await screen.findByRole('alert')).toHaveTextContent('项目列表加载失败')
    expect(screen.queryByText('还没有项目')).not.toBeInTheDocument()
    expect(toastError).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: '重试项目列表' }))

    expect(await screen.findByText('星轨项目')).toBeInTheDocument()
    expect(projectApi.list).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers the next step that fits an empty ledger', async () => {
    const user = userEvent.setup()
    vi.mocked(projectApi.list).mockResolvedValue({
      data: { data: { list: [], page: 1, page_size: 10, total: 0, total_pages: 0 } },
    } as never)

    render(<ProjectsView />, { initialEntries: ['/projects'] })

    expect(await screen.findByText('还没有项目')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /新建项目/ })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '项目状态筛选' }))
    await user.click(screen.getByRole('option', { name: '已归档' }))

    expect(await screen.findByText('没有符合条件的项目')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '清除筛选' }))

    expect(await screen.findByText('还没有项目')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '项目状态筛选' })).toHaveTextContent('全部状态')
  })

  it('shows the real percentage and a dash when there is no contract amount', async () => {
    vi.mocked(projectApi.list).mockResolvedValue({
      data: {
        data: {
          list: [
            { ...project, id: 1, name: '超收项目', received_amount: 150, total_amount: 100 },
            { ...project, id: 2, name: '无合同额项目', received_amount: 0, total_amount: 0 },
          ],
          page: 1,
          page_size: 10,
          total: 2,
          total_pages: 1,
        },
      },
    } as never)

    render(<ProjectsView />, { initialEntries: ['/projects'] })

    const overpaid = await screen.findByRole('progressbar', { name: '超收项目 收款进度' })
    expect(overpaid).toHaveAttribute('aria-valuenow', '100')
    expect(overpaid).toHaveAttribute('aria-valuetext', '150%')
    expect(screen.getByRole('progressbar', { name: '无合同额项目 收款进度' })).toHaveAttribute(
      'aria-valuetext',
      '—',
    )
  })
})
