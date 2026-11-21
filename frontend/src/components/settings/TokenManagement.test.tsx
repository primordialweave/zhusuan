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
})
