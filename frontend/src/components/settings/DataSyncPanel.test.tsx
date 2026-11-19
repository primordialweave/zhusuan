import userEvent from '@testing-library/user-event'
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
    render(<DataSyncPanel />)

    // The settings tab names the panel; the counts appear once there is a comparison to count.
    expect(screen.queryByRole('heading', { name: '数据同步' })).not.toBeInTheDocument()
    expect(screen.queryByText('待同步')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/主机地址/), 'database.example.com')
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
})
