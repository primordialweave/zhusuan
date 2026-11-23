import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncApi } from '@/api/sync'
import { render, screen, waitFor, within } from '@/test/render'
import DataSyncPanel from './DataSyncPanel'

vi.mock('@/api/sync', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/sync')>()
  return {
    ...original,
    syncApi: {
      compare: vi.fn(),
      execute: vi.fn(),
      getConfig: vi.fn(),
      testConnection: vi.fn(),
    },
  }
})

describe('DataSyncPanel design-system composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(syncApi.getConfig).mockResolvedValue({ data: { data: null } } as never)
    vi.mocked(syncApi.testConnection).mockResolvedValue({ data: { data: null } } as never)
    vi.mocked(syncApi.compare).mockResolvedValue({
      data: {
        data: [{ local_count: 12, remote_count: 8, table_name: 'users' }],
      },
    } as never)
  })

  it('moves from ODS form controls to a semantic ODS comparison table', async () => {
    const user = userEvent.setup()
    const { container } = render(<DataSyncPanel />)

    // The settings tab names the panel; the counts appear once there is a comparison to count.
    expect(screen.queryByRole('heading', { name: '数据同步' })).not.toBeInTheDocument()
    expect(screen.queryByText('待同步')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: '正在加载同步配置' })).toBeInTheDocument()
    const choices = container.querySelector('.sync-config .ods-radio-group')
    expect(choices).toHaveAttribute('data-columns', '3')
    expect(choices?.querySelectorAll('.ods-skeleton')).toHaveLength(2)
    expect(container.querySelector('.settings-loading__field.settings-field--wide')).not.toBeNull()
    await user.type(await screen.findByLabelText(/主机地址/), 'database.example.com')
    await user.type(screen.getByLabelText(/数据库名/), 'orange')
    await user.type(screen.getByLabelText(/用户名/), 'admin')
    await user.click(screen.getByRole('button', { name: /测试连接并下一步/ }))

    await waitFor(() => expect(syncApi.compare).toHaveBeenCalledOnce())
    const table = screen.getByRole('table', { name: '数据对比明细' })
    expect(table).toHaveClass('ods-table')
    expect(within(table).getByRole('columnheader', { name: '数据表' })).toBeInTheDocument()
    expect(within(table).getByText('用户表')).toBeInTheDocument()
    expect(within(table).getByText('差异')).toBeInTheDocument()
    expect(screen.getByText('待同步').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: '修改配置' })).toBeInTheDocument()
  })

  it('keeps unknown comparison results as skeletons instead of a temporary empty state', async () => {
    let resolveCompare!: (value: unknown) => void
    vi.mocked(syncApi.getConfig).mockResolvedValueOnce({
      data: { data: { host: 'demo.example.com', user: 'demo', db_name: 'demo' } },
    } as never)
    vi.mocked(syncApi.compare).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCompare = resolve
      }) as never,
    )
    const user = userEvent.setup()
    render(<DataSyncPanel />)
    await screen.findByLabelText(/主机地址/)
    await user.click(screen.getByRole('button', { name: /测试连接并下一步/ }))
    await waitFor(() => expect(syncApi.compare).toHaveBeenCalledOnce())

    expect(screen.getByRole('status', { name: '正在分析数据库差异' })).toBeInTheDocument()
    expect(screen.queryByText('暂无对比数据')).not.toBeInTheDocument()
    await act(async () => {
      resolveCompare({
        data: { data: [{ local_count: 12, remote_count: 8, table_name: 'users' }] },
      })
    })

    expect(await screen.findByRole('table', { name: '数据对比明细' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在分析数据库差异' })).not.toBeInTheDocument()
    expect(syncApi.execute).not.toHaveBeenCalled()
  })

  it('shows compare error with em-dash stats and disables sync instead of fake empty state', async () => {
    const user = userEvent.setup()
    vi.mocked(syncApi.getConfig).mockResolvedValueOnce({
      data: { data: { host: 'demo.example.com', user: 'demo', db_name: 'demo' } },
    } as never)
    vi.mocked(syncApi.compare)
      .mockRejectedValueOnce(new Error('compare failed'))
      .mockResolvedValueOnce({
        data: { data: [{ local_count: 5, remote_count: 2, table_name: 'projects' }] },
      } as never)

    render(<DataSyncPanel />)
    await screen.findByLabelText(/主机地址/)
    await user.click(screen.getByRole('button', { name: /测试连接并下一步/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('对比数据加载失败')
    expect(screen.queryByText('暂无对比数据')).not.toBeInTheDocument()
    expect(screen.getByText('数据表').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('待同步').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByRole('button', { name: '开始同步' })).toBeDisabled()

    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: '重新对比' }))
    expect(await screen.findByRole('table', { name: '数据对比明细' })).toBeInTheDocument()
    expect(screen.getByText('数据表', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: '开始同步' })).toBeEnabled()
  })

  it('keeps existing comparison rows on same-config refresh failure but clears them on new-config failure', async () => {
    const user = userEvent.setup()
    vi.mocked(syncApi.getConfig).mockResolvedValueOnce({
      data: { data: { host: 'first.example.com', user: 'demo', db_name: 'demo' } },
    } as never)
    vi.mocked(syncApi.compare)
      .mockResolvedValueOnce({
        data: { data: [{ local_count: 12, remote_count: 8, table_name: 'users' }] },
      } as never)
      .mockRejectedValueOnce(new Error('same-scope refresh failed'))
      .mockRejectedValueOnce(new Error('new-scope compare failed'))

    render(<DataSyncPanel />)
    await screen.findByLabelText(/主机地址/)
    await user.click(screen.getByRole('button', { name: /测试连接并下一步/ }))
    expect(await screen.findByText('用户表')).toBeInTheDocument()

    // Same-config refresh failure keeps current comparison table
    await user.click(screen.getByRole('button', { name: '重新对比' }))
    await waitFor(() => expect(syncApi.compare).toHaveBeenCalledTimes(2))
    expect(screen.getByText('用户表')).toBeInTheDocument()
    expect(screen.queryByText('对比数据加载失败')).not.toBeInTheDocument()

    // Switching config and failing must not leak previous host's rows or counts
    await user.click(screen.getByRole('button', { name: '修改配置' }))
    const hostInput = await screen.findByLabelText(/主机地址/)
    await user.clear(hostInput)
    await user.type(hostInput, 'second.example.com')
    await user.click(screen.getByRole('button', { name: /测试连接并下一步/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('对比数据加载失败')
    expect(screen.queryByText('用户表')).not.toBeInTheDocument()
    expect(screen.getByText('数据表').nextElementSibling).toHaveTextContent('—')
  })

  it('does not execute a confirmation after the sync panel has been removed', async () => {
    const user = userEvent.setup()
    vi.mocked(syncApi.getConfig).mockResolvedValueOnce({
      data: { data: { host: 'demo.example.com', user: 'demo', db_name: 'demo' } },
    } as never)
    const { rerender } = render(<DataSyncPanel />)
    await screen.findByLabelText(/主机地址/)
    await user.click(screen.getByRole('button', { name: /测试连接并下一步/ }))
    await screen.findByRole('table', { name: '数据对比明细' })
    await user.click(screen.getByRole('button', { name: '开始同步' }))
    const dialog = screen.getByRole('alertdialog', { name: '确认同步' })
    rerender(<div>已离开同步设置</div>)
    await user.click(within(dialog).getByRole('button', { name: '开始同步' }))
    expect(syncApi.execute).not.toHaveBeenCalled()
  })

  it('does not launch comparison after an obsolete connection test finishes', async () => {
    const user = userEvent.setup()
    let resolveTest!: (value: unknown) => void
    vi.mocked(syncApi.getConfig).mockResolvedValueOnce({
      data: { data: { host: 'demo.example.com', user: 'demo', db_name: 'demo' } },
    } as never)
    vi.mocked(syncApi.testConnection).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTest = resolve
      }) as never,
    )
    const { rerender } = render(<DataSyncPanel />)
    await screen.findByLabelText(/主机地址/)
    await user.click(screen.getByRole('button', { name: /测试连接并下一步/ }))
    rerender(<div>已离开同步设置</div>)
    await act(async () => {
      resolveTest({ data: { data: null } })
    })
    expect(syncApi.compare).not.toHaveBeenCalled()
  })
})
