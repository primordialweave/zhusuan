import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenApi } from '@/api/token'
import { fireEvent, render, screen, waitFor, within } from '@/test/render'
import TokenManagement from './TokenManagement'

vi.mock('@/api/token', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/token')>()
  return {
    ...original,
    tokenApi: {
      ...original.tokenApi,
      create: vi.fn(),
      list: vi.fn(),
    },
  }
})

const emptyTokenResponse = { data: { data: [] } }

describe('TokenManagement modal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(tokenApi.list).mockResolvedValue(emptyTokenResponse as never)
  })

  it('does not revoke a token after its confirmation outlives the panel', async () => {
    const user = userEvent.setup()
    const revoke = vi.spyOn(tokenApi, 'revoke').mockResolvedValue({ data: { data: null } } as never)
    vi.mocked(tokenApi.list).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 4,
            name: '旧令牌',
            scopes: '',
            status: 1,
            last_used_at: null,
            expires_at: null,
            create_time: '2026-11-01',
          },
        ],
      },
    } as never)
    const { rerender } = render(<TokenManagement />)
    await user.click(await screen.findByRole('button', { name: '撤销令牌：旧令牌' }))
    const dialog = screen.getByRole('alertdialog', { name: '撤销令牌' })
    rerender(<div>已离开令牌设置</div>)
    await user.click(within(dialog).getByRole('button', { name: '撤销令牌' }))
    expect(revoke).not.toHaveBeenCalled()
  })

  it('keeps an initial token request as a skeleton until it resolves empty', async () => {
    let resolveRequest!: (value: typeof emptyTokenResponse) => void
    vi.mocked(tokenApi.list).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }) as never,
    )
    render(<TokenManagement />)

    expect(screen.getByRole('status', { name: '正在加载令牌列表' })).toBeInTheDocument()
    expect(screen.queryByText('暂无访问令牌')).not.toBeInTheDocument()
    await waitFor(() => expect(tokenApi.list).toHaveBeenCalledOnce())
    await act(async () => resolveRequest(emptyTokenResponse))

    expect(await screen.findByText('暂无访问令牌')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载令牌列表' })).not.toBeInTheDocument()
  })

  it('uses shared modal layout and card-style ODS radios in the portalled dialog', async () => {
    const user = userEvent.setup()
    render(<TokenManagement />)

    await waitFor(() => expect(tokenApi.list).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: '生成新令牌' }))

    const dialog = screen.getByRole('dialog', { name: '生成新令牌' })
    expect(dialog.querySelector('.settings-modal-body')).not.toBeNull()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(5)
    radios.forEach((radio) => {
      expect(radio.closest('.ods-radio')).toHaveAttribute('data-variant', 'card')
    })
  })

  it('does not create duplicate tokens from repeated Enter presses', async () => {
    const user = userEvent.setup()
    let resolveCreate: ((value: unknown) => void) | undefined
    vi.mocked(tokenApi.create).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve
        }) as never,
    )
    render(<TokenManagement />)

    await user.click(await screen.findByRole('button', { name: '生成新令牌' }))
    await user.type(screen.getByRole('textbox', { name: /令牌名称/ }), 'CI token')
    await user.keyboard('{Enter}{Enter}')

    expect(tokenApi.create).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveCreate?.({ data: { data: { token: 'orange-secret' } } })
    })
  })

  it('keeps the one-time token visible when the modal scrim is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(tokenApi.create).mockResolvedValue({
      data: { data: { token: 'orange-secret' } },
    } as never)
    render(<TokenManagement />)

    await user.click(await screen.findByRole('button', { name: '生成新令牌' }))
    await user.type(screen.getByRole('textbox', { name: /令牌名称/ }), 'CI token')
    const createDialog = screen.getByRole('dialog', { name: '生成新令牌' })
    await user.click(within(createDialog).getByRole('button', { name: '生成令牌' }))

    const dialog = await screen.findByRole('dialog', { name: '令牌生成成功' })
    fireEvent.click(dialog.parentElement!)
    expect(dialog).toBeInTheDocument()
  })

  it('wraps a long one-time token while copying the exact value', async () => {
    const user = userEvent.setup()
    const publicFixture = 'pat_public_fixture_' + 'a'.repeat(256)
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    vi.mocked(tokenApi.create).mockResolvedValue({
      data: { data: { token: publicFixture } },
    } as never)
    render(<TokenManagement />)
    await user.click(await screen.findByRole('button', { name: '生成新令牌' }))
    fireEvent.change(screen.getByRole('textbox', { name: /令牌名称/ }), {
      target: { value: '公开测试令牌' },
    })
    await user.click(screen.getByRole('button', { name: '生成令牌' }))
    const dialog = await screen.findByRole('dialog', { name: '令牌生成成功' })
    const snippet = dialog.querySelector('[data-slot="snippet"]')
    expect(snippet).toHaveAttribute('data-wrap', 'true')
    expect(snippet?.querySelector('[data-slot="content"]')?.textContent).toBe(publicFixture)
    await user.click(within(dialog).getByRole('button', { name: '复制令牌' }))
    expect(copy).toHaveBeenCalledWith(publicFixture)
    await user.click(within(dialog).getByRole('button', { name: '我已保存' }))
    expect(screen.queryByRole('dialog', { name: '令牌生成成功' })).not.toBeInTheDocument()
  })

  it('shows an error state instead of a fake empty state when initial loading fails, then recovers on retry', async () => {
    const user = userEvent.setup()
    vi.mocked(tokenApi.list)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              create_time: '2026-11-01T00:00:00Z',
              expires_at: null,
              id: 11,
              last_used_at: null,
              name: '生产同步令牌',
              status: 1,
            },
          ],
        },
      } as never)

    render(<TokenManagement />)

    expect(await screen.findByRole('alert')).toHaveTextContent('令牌列表加载失败')
    expect(screen.queryByText('暂无访问令牌')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载令牌列表' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重新加载' }))
    expect(await screen.findByText('生产同步令牌')).toBeInTheDocument()
  })

  it('does not fall back to empty state when refreshing after creating the first token fails', async () => {
    const user = userEvent.setup()
    vi.mocked(tokenApi.list)
      .mockResolvedValueOnce(emptyTokenResponse as never)
      .mockRejectedValueOnce(new Error('refresh failed'))
    vi.mocked(tokenApi.create).mockResolvedValueOnce({
      data: { data: { token: 'pat_first_secret' } },
    } as never)

    render(<TokenManagement />)

    expect(await screen.findByText('暂无访问令牌')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '生成新令牌' }))
    await user.type(screen.getByRole('textbox', { name: /令牌名称/ }), '首个令牌')
    const createDialog = screen.getByRole('dialog', { name: '生成新令牌' })
    await user.click(within(createDialog).getByRole('button', { name: '生成令牌' }))

    const successDialog = await screen.findByRole('dialog', { name: '令牌生成成功' })
    await user.click(within(successDialog).getByRole('button', { name: '我已保存' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('令牌列表加载失败')
    expect(screen.queryByText('暂无访问令牌')).not.toBeInTheDocument()
  })

  it('uses secondary revoke and soft-danger delete button hierarchy for token rows', async () => {
    vi.mocked(tokenApi.list).mockResolvedValueOnce({
      data: {
        data: [
          {
            create_time: '2026-11-01T00:00:00Z',
            expires_at: null,
            id: 21,
            last_used_at: null,
            name: '活跃令牌',
            status: 1,
          },
          {
            create_time: '2026-10-01T00:00:00Z',
            expires_at: null,
            id: 22,
            last_used_at: null,
            name: '已撤销令牌',
            status: 0,
          },
        ],
      },
    } as never)

    render(<TokenManagement />)
    expect(await screen.findByText('活跃令牌')).toBeInTheDocument()

    const revokeButton = screen.getByRole('button', { name: '撤销令牌：活跃令牌' })
    const deleteActiveButton = screen.getByRole('button', { name: '删除令牌：活跃令牌' })
    const deleteRevokedButton = screen.getByRole('button', { name: '删除令牌：已撤销令牌' })

    expect(revokeButton).toHaveAttribute('data-variant', 'secondary')
    expect(deleteActiveButton).toHaveAttribute('data-variant', 'tertiary')
    expect(deleteActiveButton).toHaveAttribute('data-tone', 'danger')
    expect(deleteRevokedButton).toHaveAttribute('data-variant', 'tertiary')
    expect(deleteRevokedButton).toHaveAttribute('data-tone', 'danger')
  })
})
