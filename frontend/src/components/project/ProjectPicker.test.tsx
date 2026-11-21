import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { projectApi, type Project } from '@/api/project'
import { Field } from '@/design-system'
import { render } from '@/test/render'
import { ProjectPicker } from './ProjectPicker'

vi.mock('@/api/project', () => ({ projectApi: { list: vi.fn() } }))
const project = (id: number) => ({ id, name: `项目${id}` }) as Project
const reply = (list: Project[], total: number) => ({ data: { data: { list, total } } })

describe('paged project picker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows skeletons while the first page is pending and does not get stuck on a repeated search', async () => {
    let finish!: (value: never) => void
    vi.mocked(projectApi.list).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const user = userEvent.setup()
    render(<ProjectPicker onValueChange={() => undefined} />)

    await user.click(screen.getByRole('button', { name: '选择项目' }))
    const status = screen.getByRole('status', { name: '正在加载项目' })
    expect(status.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(5)
    expect(screen.queryByText('没有匹配项目')).not.toBeInTheDocument()
    await waitFor(() => expect(projectApi.list).toHaveBeenCalled())

    finish(reply([project(1)], 1) as never)
    await screen.findByRole('option', { name: '项目1' })
    await user.type(screen.getByRole('searchbox', { name: '搜索所属项目' }), '{Enter}')
    expect(screen.queryByRole('status', { name: '正在加载项目' })).not.toBeInTheDocument()
    expect(projectApi.list).toHaveBeenCalledTimes(1)
  })

  it('loads only on demand, changes pages, and finds projects beyond the first 100', async () => {
    vi.mocked(projectApi.list).mockImplementation((params) =>
      Promise.resolve(
        reply(
          params?.keyword ? [project(142)] : [project(params?.page === 2 ? 21 : 1)],
          142,
        ) as never,
      ),
    )
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Field.Root>
        <Field.Label>所属项目</Field.Label>
        <ProjectPicker value={project(1)} onValueChange={onChange} />
      </Field.Root>,
    )
    expect(projectApi.list).not.toHaveBeenCalled()
    await user.click(screen.getByText('所属项目'))
    await screen.findByRole('option', { name: '项目1' })
    expect(projectApi.list).toHaveBeenCalledWith({ page: 1, page_size: 20, keyword: undefined })
    await user.click(screen.getByRole('button', { name: '下一页项目' }))
    await screen.findByRole('option', { name: '项目21' })
    const search = screen.getByRole('searchbox', { name: '搜索所属项目' })
    await user.type(search, '列表后面{Enter}')
    await screen.findByRole('option', { name: '项目142' })
    expect(projectApi.list).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 20,
      keyword: '列表后面',
    })
    await user.click(screen.getByRole('option', { name: '项目142' }))
    expect(onChange).toHaveBeenCalledWith(project(142))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })

  it('does not replace a later search with an old delayed page response', async () => {
    let finish!: (value: never) => void
    vi.mocked(projectApi.list).mockImplementation((params) =>
      params?.keyword
        ? Promise.resolve(reply([project(142)], 1) as never)
        : new Promise((resolve) => {
            finish = resolve
          }),
    )
    const user = userEvent.setup()
    render(
      <Field.Root>
        <Field.Label>所属项目</Field.Label>
        <ProjectPicker value={project(1)} onValueChange={() => undefined} />
      </Field.Root>,
    )
    await user.click(screen.getByRole('button', { name: '选择项目' }))
    await waitFor(() => expect(projectApi.list).toHaveBeenCalledTimes(1))
    await user.type(screen.getByRole('searchbox', { name: '搜索所属项目' }), '指定{Enter}')
    await screen.findByRole('option', { name: '项目142' })
    finish(reply([project(1)], 142) as never)
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: '项目1' })).not.toBeInTheDocument(),
    )
  })
})
