import { useEffect, type ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Browser } from '@wailsio/runtime'
import type { User } from '@/api/auth'
import { DEFAULT_APP_SLOGAN, DEFAULT_WECHAT_PUBLIC_ACCOUNT, systemApi } from '@/api/system'
import { useToastStore } from '@/composables/useToast'
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, useAppearanceStore } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { render, screen, waitFor, within } from '@/test/render'
import { appUpdater, type UpdateInfo, type UpdateStatus } from '@/utils/appUpdater'
import SettingsView from './SettingsView'
import pkg from '../../package.json'

vi.mock('@/api/system', () => ({
  DEFAULT_APP_SLOGAN: '心中有数，账目有序',
  DEFAULT_WECHAT_PUBLIC_ACCOUNT: '原初织界',
  systemApi: {
    info: vi.fn().mockResolvedValue({
      data: {
        code: 0,
        data: {
          version: '1.0.2',
          slogan: '心中有数，账目有序',
          wechat_public_account: '原初织界',
        },
      },
    }),
  },
}))

vi.mock('@/utils/appUpdater', () => ({
  appUpdater: {
    isAvailable: vi.fn().mockReturnValue(false),
    checkForUpdates: vi.fn(),
    startUpdate: vi.fn(),
    status: vi.fn(),
    cancelUpdate: vi.fn(),
  },
}))

vi.mock('@/components/settings/TokenManagement', () => ({
  default: ({ actions }: { actions?: ReactNode }) => (
    <div data-testid="token-management">{actions}</div>
  ),
}))

const adminUser: User = {
  avatar: '',
  department: '产品部',
  email: 'admin@example.com',
  id: 1,
  name: '管理员',
  phone: '13800138000',
  position: '负责人',
  role: 'admin',
  status: 1,
  username: 'admin',
}

const memberUser: User = {
  ...adminUser,
  id: 2,
  name: '普通用户',
  role: 'user',
  username: 'member',
}

function RouteProbe({ onNavigate }: { onNavigate?: (navigate: NavigateFunction) => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    onNavigate?.(navigate)
  }, [navigate, onNavigate])

  return <output data-testid="settings-location">{`${location.pathname}${location.search}`}</output>
}

describe('SettingsView', () => {
  const originalChangePassword = useAuthStore.getState().changePassword
  const originalLogout = useAuthStore.getState().logout
  const originalRefreshUser = useAuthStore.getState().refreshUser
  const originalUpdateProfile = useAuthStore.getState().updateProfile
  const originalUser = useAuthStore.getState().user

  beforeEach(() => {
    window.localStorage.clear()
    useThemeStore.setState({ effectiveTheme: 'light', theme: 'auto' })
    useAppearanceStore.setState(DEFAULT_APPEARANCE)
    useAuthStore.setState({
      refreshUser: vi.fn().mockResolvedValue(undefined),
      user: adminUser,
    })
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthStore.setState({
      changePassword: originalChangePassword,
      logout: originalLogout,
      refreshUser: originalRefreshUser,
      updateProfile: originalUpdateProfile,
      user: originalUser,
    })
    document.documentElement.removeAttribute('data-glass')
    document.documentElement.removeAttribute('data-motion')
    vi.unstubAllGlobals()
  })

  it('offers the theme as three pictured choices that stay synchronized with the theme store', async () => {
    const user = userEvent.setup()
    render(<SettingsView />, { initialEntries: ['/settings?tab=appearance'] })

    const tabs = screen.getByRole('tablist', { name: '设置分类' })
    expect(tabs).toHaveClass('ods-tabs__list')
    expect(tabs).toHaveAttribute('data-variant', 'navigation')

    const theme = screen.getByRole('group', { name: '界面主题' })
    expect(theme).toHaveClass('ods-radio-group')
    expect(
      within(theme)
        .getAllByRole('radio')
        .map((option) => option.closest('label')?.textContent),
    ).toEqual(['浅色', '深色', '跟随系统'])
    // 跟随系统 shows both themes; each layer is painted with that theme's own tokens.
    expect(
      Array.from(theme.querySelectorAll('.settings-theme__layer')).map((layer) =>
        layer.getAttribute('data-theme'),
      ),
    ).toEqual(['light', 'dark', 'light', 'dark'])

    const appIconGroup = screen.getByRole('group', { name: '应用图标' })
    expect(appIconGroup).toHaveClass('ods-radio-group')
    expect(
      within(appIconGroup)
        .getAllByRole('radio')
        .map((option) => option.closest('label')?.textContent),
    ).toEqual(['浅色', '深色', '跟随系统'])
    expect(
      Array.from(appIconGroup.querySelectorAll('.settings-app-icon__layer')).map((layer) =>
        layer.getAttribute('data-theme'),
      ),
    ).toEqual(['light', 'dark', 'light', 'dark'])
    expect(
      Array.from(appIconGroup.querySelectorAll('img')).map((img) => img.getAttribute('src')),
    ).toEqual(['/zhusuan.png', '/zhusuan-dark.png', '/zhusuan.png', '/zhusuan-dark.png'])

    expect(within(appIconGroup).getByRole('radio', { name: '跟随系统' })).toBeChecked()
    await user.click(within(appIconGroup).getByRole('radio', { name: '深色' }))
    expect(useAppearanceStore.getState().appIcon).toBe('dark')
    expect(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)!).appIcon).toBe('dark')
    await user.click(within(appIconGroup).getByRole('radio', { name: '浅色' }))
    expect(useAppearanceStore.getState().appIcon).toBe('light')
    expect(within(theme).getByRole('radio', { name: '跟随系统' })).toBeChecked()

    await user.click(within(theme).getByRole('radio', { name: '深色' }))
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(within(theme).getByRole('radio', { name: '深色' })).toBeChecked()
    expect(window.localStorage.getItem('theme')).toBe('dark')
  })

  it('applies and stores each appearance switch the moment it is flipped', async () => {
    const user = userEvent.setup()
    render(<SettingsView />, { initialEntries: ['/settings?tab=appearance'] })

    const scene = screen.getByRole('switch', { name: '江南动态场景' })
    const reduce = screen.getByRole('switch', { name: '减少动态效果' })
    const glass = screen.getByRole('switch', { name: '液态玻璃效果' })
    expect(scene).toBeChecked()
    expect(reduce).not.toBeChecked()
    expect(glass).toBeChecked()

    await user.click(reduce)
    await user.click(glass)

    expect(useAppearanceStore.getState()).toMatchObject({ liquidGlass: false, reduceMotion: true })
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
    expect(document.documentElement).toHaveAttribute('data-glass', 'solid')
    expect(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}')).toEqual({
      appIcon: 'auto',
      liquidGlass: false,
      reduceMotion: true,
      sceneMotion: true,
    })
  })

  it('composes profile actions and fields from Orange Design System', () => {
    render(<SettingsView />, { initialEntries: ['/settings?tab=profile'] })

    expect(screen.getByRole('button', { name: '保存更改' })).toHaveClass('ods-button')
    expect(screen.getByRole('textbox', { name: '姓名' })).toHaveClass('ods-input')
    expect(screen.getByRole('textbox', { name: '部门' }).closest('.ods-field')).not.toBeNull()
  })

  it('opens with the page heading and keeps every section on one tab strip', () => {
    render(<SettingsView />, { initialEntries: ['/settings?tab=profile'] })

    expect(screen.getByRole('heading', { level: 1, name: '系统设置' })).toBeInTheDocument()
    expect(document.querySelector('.ods-page-header__description, .scene-page__text')).toBeNull()
    expect(screen.queryByLabelText('设置导航')).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '个人信息',
      '外观设置',
      '通知设置',
      '数据同步',
      '用户管理',
      '字典管理',
      '开发设置',
      '关于',
    ])
  })

  it('signs the account out from the profile tab and returns to the login page', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ logout })
    const user = userEvent.setup()
    render(
      <>
        <SettingsView />
        <RouteProbe />
      </>,
      { initialEntries: ['/settings?tab=profile'] },
    )

    expect(screen.getByText('admin')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '退出登录' }))

    expect(logout).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByTestId('settings-location')).toHaveTextContent('/login'))
  })

  it('links the component gallery from the developer tab', () => {
    render(<SettingsView />, { initialEntries: ['/settings?tab=developer'] })

    const gallery = within(screen.getByTestId('token-management')).getByRole('link', {
      name: '组件展厅',
    })
    expect(gallery).toHaveAttribute('href', '/design-system')
    expect(gallery).toHaveClass('ods-button')
  })

  it('derives the authorized active tab from the URL and follows same-route history', async () => {
    const user = userEvent.setup()
    let routeNavigate: NavigateFunction | null = null
    const captureNavigate = (navigate: NavigateFunction) => {
      routeNavigate = navigate
    }
    render(
      <>
        <SettingsView />
        <RouteProbe onNavigate={captureNavigate} />
      </>,
      { initialEntries: ['/settings?tab=profile'] },
    )

    await user.click(screen.getByRole('tab', { name: '关于' }))
    expect(screen.getByTestId('settings-location')).toHaveTextContent('/settings?tab=about')
    expect(screen.getByRole('tab', { name: '关于' })).toHaveAttribute('aria-selected', 'true')

    act(() => routeNavigate?.(-1))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '个人信息' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )

    // 安全设置 now lives on the profile page; an old link to it still lands there.
    act(() => routeNavigate?.('/settings?tab=about'))
    act(() => routeNavigate?.('/settings?tab=security'))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '个人信息' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.getByLabelText('当前密码')).toBeInTheDocument()
  })

  it('rejects role-restricted tabs without rewriting the requested URL', () => {
    useAuthStore.setState({ user: memberUser })
    render(
      <>
        <SettingsView />
        <RouteProbe />
      </>,
      { initialEntries: ['/settings?tab=users'] },
    )

    expect(screen.queryByRole('tab', { name: '用户管理' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '个人信息' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('settings-location')).toHaveTextContent('/settings?tab=users')
  })

  it('preserves a dirty profile through a late refresh and resets it for a new identity', async () => {
    vi.useFakeTimers()
    const refreshedUser = { ...adminUser, name: '服务端姓名', position: '服务端职位' }
    let completeRefresh = () => {}
    const refreshUser = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeRefresh = () => {
            useAuthStore.setState({ user: refreshedUser })
            resolve()
          }
        }),
    )
    useAuthStore.setState({ refreshUser, user: adminUser })
    render(<SettingsView />, { initialEntries: ['/settings?tab=profile'] })

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(refreshUser).toHaveBeenCalledOnce()

    const nameInput = screen.getByRole('textbox', { name: '姓名' })
    fireEvent.change(nameInput, { target: { value: '尚未保存的草稿' } })

    act(() => completeRefresh())
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(nameInput).toHaveValue('尚未保存的草稿')

    act(() => useAuthStore.setState({ user: memberUser }))
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(nameInput).toHaveValue('普通用户')
  })

  it('changes the password from the profile page, below the profile form', async () => {
    const changePassword = vi.fn().mockResolvedValue(true)
    useAuthStore.setState({ changePassword })
    const user = userEvent.setup()
    render(<SettingsView />, { initialEntries: ['/settings?tab=profile'] })

    expect(screen.queryByRole('tab', { name: '安全设置' })).not.toBeInTheDocument()
    const groups = screen
      .getAllByRole('region')
      .map((group) => group.getAttribute('aria-labelledby'))
    expect(groups).toHaveLength(2)
    const [profileGroup, securityGroup] = screen.getAllByRole('region')
    expect(profileGroup).toHaveAccessibleName('个人信息')
    expect(securityGroup).toHaveAccessibleName('安全设置')
    // Both save buttons sit in their card's footer row, which packs its content to the end.
    for (const name of ['保存更改', '修改密码']) {
      expect(screen.getByRole('button', { name }).parentElement).toHaveClass(
        'settings-group__footer',
      )
    }
    await user.type(screen.getByLabelText('当前密码'), 'old-secret')
    await user.type(screen.getByLabelText('新密码'), 'new-secret')
    await user.type(screen.getByLabelText('确认新密码'), 'new-secret')
    await user.click(screen.getByRole('button', { name: '修改密码' }))

    expect(changePassword).toHaveBeenCalledWith('old-secret', 'new-secret')
  })

  it('lists the About facts with the jade wordmark and default slogan', async () => {
    const { container } = render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    expect(screen.getByRole('heading', { level: 2, name: '珠算' })).toBeInTheDocument()
    expect(container.querySelector('.about-brandmark img')).toHaveAttribute(
      'src',
      '/zhusuan-wordmark.png',
    )
    expect(await screen.findByText(DEFAULT_APP_SLOGAN)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_WECHAT_PUBLIC_ACCOUNT)).toBeInTheDocument()
    await waitFor(() => expect(systemApi.info).toHaveBeenCalled())
    const repository = screen.getByRole('button', { name: 'primordialweave/zhusuan' })
    expect(repository).toHaveClass('ods-button')
    expect(repository).toHaveAccessibleDescription('开源地址')
    expect(screen.getByRole('button', { name: '检测更新' })).toHaveClass('ods-button')
  })

  it('displays the configured slogan from the backend', async () => {
    vi.mocked(systemApi.info).mockResolvedValueOnce({
      data: { code: 0, data: { version: '1.0.2', slogan: '  每一笔，都有着落  ' } },
    } as never)
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    expect(await screen.findByText('每一笔，都有着落')).toBeInTheDocument()
    expect(screen.queryByText('小旭姐专属记账工具')).not.toBeInTheDocument()
  })

  it('shows inline branding skeletons until the initial system info response resolves', async () => {
    let resolveInfo!: (value: unknown) => void
    vi.mocked(systemApi.info).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInfo = resolve
      }) as never,
    )
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    expect(screen.getByRole('status', { name: '正在加载应用介绍' })).toBeInTheDocument()
    expect(screen.queryByText(DEFAULT_APP_SLOGAN)).not.toBeInTheDocument()
    await act(async () => {
      resolveInfo({
        data: { data: { slogan: '账目有序', wechat_public_account: '账本小记' } },
      })
    })

    expect(await screen.findByText('账目有序')).toBeInTheDocument()
    expect(screen.getByText('账本小记')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载应用介绍' })).not.toBeInTheDocument()
  })

  it('ends unknown profile loading as a retryable failure without exposing save actions', async () => {
    let resolveFirst!: () => void
    let resolveRetry!: () => void
    const firstRequest = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    const retryRequest = new Promise<void>((resolve) => {
      resolveRetry = resolve
    })
    const refreshUser = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockImplementationOnce(async () => {
        await retryRequest
        useAuthStore.setState({ user: adminUser })
      })
    useAuthStore.setState({ user: null, refreshUser })
    render(<SettingsView />, { initialEntries: ['/settings?tab=profile'] })

    expect(screen.getByRole('status', { name: '正在加载账户概览' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '正在加载个人信息' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存更改' })).not.toBeInTheDocument()
    await waitFor(() => expect(refreshUser).toHaveBeenCalledOnce())
    await act(async () => resolveFirst())

    expect(await screen.findByText('个人信息加载失败')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载账户概览' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存更改' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '修改密码' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '重新加载个人信息' }))
    expect(screen.getByRole('status', { name: '正在加载账户概览' })).toBeInTheDocument()
    await act(async () => resolveRetry())

    expect(await screen.findByRole('button', { name: '保存更改' })).toBeEnabled()
    expect(screen.queryByText('个人信息加载失败')).not.toBeInTheDocument()
    expect(refreshUser).toHaveBeenCalledTimes(2)
  })

  it('keeps the default slogan when branding cannot be loaded', async () => {
    vi.mocked(systemApi.info).mockRejectedValueOnce(new Error('temporarily offline'))
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    await act(async () => {})
    expect(screen.getByText(DEFAULT_APP_SLOGAN)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_WECHAT_PUBLIC_ACCOUNT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '检测更新' })).toBeEnabled()
  })

  it('displays the configured WeChat public account', async () => {
    vi.mocked(systemApi.info).mockResolvedValueOnce({
      data: {
        code: 0,
        data: {
          version: '1.0.2',
          slogan: DEFAULT_APP_SLOGAN,
          wechat_public_account: '  账本小记  ',
        },
      },
    } as never)
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    expect(await screen.findByText('账本小记')).toBeInTheDocument()
    expect(screen.queryByText('为学书院')).not.toBeInTheDocument()
  })

  it.each([undefined, '  '])('uses the default WeChat name for %s', async (account) => {
    vi.mocked(systemApi.info).mockResolvedValueOnce({
      data: {
        code: 0,
        data: { version: '1.0.2', slogan: DEFAULT_APP_SLOGAN, wechat_public_account: account },
      },
    } as never)
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    await act(async () => {})
    expect(screen.getByText(DEFAULT_WECHAT_PUBLIC_ACCOUNT)).toBeInTheDocument()
  })
})

describe('SettingsView in-app updates', () => {
  const originalAuthState = useAuthStore.getState()
  const info: UpdateInfo = {
    currentVersion: '1.0.0',
    latestVersion: '1.1.0',
    available: true,
    supported: true,
    reason: '',
    releaseURL: 'https://github.com/primordialweave/zhusuan/releases/tag/v1.1.0',
    releaseNotes: '',
  }
  const idle: UpdateStatus = {
    state: 'idle',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    message: '',
  }
  const downloading: UpdateStatus = {
    state: 'downloading',
    progress: 42,
    downloadedBytes: 42,
    totalBytes: 100,
    message: '正在下载更新',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(appUpdater.isAvailable).mockReturnValue(true)
    vi.mocked(appUpdater.checkForUpdates).mockResolvedValue(info)
    vi.mocked(appUpdater.startUpdate).mockResolvedValue(undefined)
    vi.mocked(appUpdater.status).mockResolvedValue(idle)
    vi.mocked(appUpdater.cancelUpdate).mockResolvedValue(undefined)
    vi.mocked(Browser.OpenURL).mockResolvedValue(undefined)
    vi.spyOn(useToastStore.getState(), 'error').mockImplementation(() => 0)
    vi.spyOn(useToastStore.getState(), 'success').mockImplementation(() => 0)
    vi.spyOn(useToastStore.getState(), 'info').mockImplementation(() => 0)
    useAuthStore.setState({
      refreshUser: vi.fn().mockResolvedValue(undefined),
      user: adminUser,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    useAuthStore.setState(originalAuthState)
  })

  async function confirmUpdate() {
    fireEvent.click(await screen.findByRole('button', { name: '检测更新' }))
    fireEvent.click(await screen.findByRole('button', { name: '更新并重启' }))
  }

  it.each([
    idle,
    downloading,
    { ...idle, state: 'error', message: '更新失败' } satisfies UpdateStatus,
  ])('keeps updater restoration as a skeleton until $state is known', async (status) => {
    let resolveStatus!: (value: UpdateStatus) => void
    vi.mocked(appUpdater.status)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStatus = resolve
        }),
      )
      .mockResolvedValue(status)
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    expect(screen.getByRole('status', { name: '正在恢复更新状态' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '检测更新' })).not.toBeInTheDocument()
    expect(screen.getByText(`v${pkg.version}`)).toBeInTheDocument()
    await act(async () => resolveStatus(status))

    expect(screen.queryByRole('status', { name: '正在恢复更新状态' })).not.toBeInTheDocument()
    if (status.state === 'downloading') {
      expect(await screen.findByRole('progressbar', { name: '应用更新进度' })).toHaveAttribute(
        'aria-valuenow',
        '42',
      )
    } else {
      expect(
        await screen.findByRole('button', {
          name: status.state === 'error' ? '重试更新' : '检测更新',
        }),
      ).toBeEnabled()
    }
    expect(appUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(appUpdater.startUpdate).not.toHaveBeenCalled()
  })

  it('ends the restore skeleton after a status request fails without starting an update', async () => {
    vi.mocked(appUpdater.status).mockRejectedValueOnce(new Error('native status unavailable'))
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    expect(screen.getByRole('status', { name: '正在恢复更新状态' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '检测更新' })).toBeEnabled()
    expect(screen.queryByRole('status', { name: '正在恢复更新状态' })).not.toBeInTheDocument()
    expect(appUpdater.startUpdate).not.toHaveBeenCalled()
  })

  it('downloads the update in-app after confirmation and shows the installed version and progress', async () => {
    vi.mocked(appUpdater.status).mockResolvedValueOnce(idle).mockResolvedValue(downloading)
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    await confirmUpdate()

    await waitFor(() =>
      expect(screen.getByRole('progressbar', { name: '应用更新进度' })).toHaveAttribute(
        'aria-valuenow',
        '42',
      ),
    )
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '正在更新' })).toBeDisabled()
    expect(appUpdater.startUpdate).toHaveBeenCalledOnce()
    expect(Browser.OpenURL).not.toHaveBeenCalled()
  })

  it('does not install when the update confirmation is dismissed', async () => {
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    fireEvent.click(await screen.findByRole('button', { name: '检测更新' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '检测更新' })).toBeEnabled())
    expect(appUpdater.startUpdate).not.toHaveBeenCalled()
    expect(screen.queryByRole('progressbar', { name: '应用更新进度' })).not.toBeInTheDocument()
  })

  it('does not offer an install or poll when there is no newer version', async () => {
    vi.mocked(appUpdater.checkForUpdates).mockResolvedValue({ ...info, available: false })
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    fireEvent.click(await screen.findByRole('button', { name: '检测更新' }))

    await waitFor(() => expect(useToastStore.getState().success).toHaveBeenCalled())
    expect(appUpdater.startUpdate).not.toHaveBeenCalled()
    expect(appUpdater.status).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('allows cancelling a download and stops polling once cancellation completes', async () => {
    vi.mocked(appUpdater.status).mockResolvedValueOnce(idle).mockResolvedValue(downloading)
    vi.mocked(appUpdater.cancelUpdate).mockImplementation(async () => {
      vi.mocked(appUpdater.status).mockResolvedValue({
        ...idle,
        state: 'available',
        message: '已取消下载',
      })
    })
    const { unmount } = render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    await confirmUpdate()
    fireEvent.click(await screen.findByRole('button', { name: '取消下载' }))

    await waitFor(() => expect(screen.getByText('已取消下载')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '检测更新' })).toBeEnabled()
    expect(screen.queryByRole('progressbar', { name: '应用更新进度' })).not.toBeInTheDocument()
    expect(appUpdater.cancelUpdate).toHaveBeenCalledOnce()
    const calls = vi.mocked(appUpdater.status).mock.calls.length
    vi.useFakeTimers()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(appUpdater.status).toHaveBeenCalledTimes(calls)
    unmount()
  })

  it('reports an installation failure and offers a fresh check for retry', async () => {
    vi.mocked(appUpdater.status)
      .mockResolvedValueOnce(idle)
      .mockResolvedValue({ ...idle, state: 'error', message: '更新包校验失败' })
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    await confirmUpdate()

    expect(await screen.findByText('更新包校验失败')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: '重试更新' })
    expect(retry).toBeEnabled()
    expect(useToastStore.getState().error).toHaveBeenCalledWith('更新包校验失败')
    fireEvent.click(retry)
    await screen.findByRole('button', { name: '更新并重启' })
    expect(appUpdater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('restores the prior updater failure on mount without repeatedly checking the service', async () => {
    vi.mocked(appUpdater.status).mockResolvedValue({
      ...idle,
      state: 'error',
      message: '安装失败，已恢复旧版本',
    })
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    expect(await screen.findByText('安装失败，已恢复旧版本')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试更新' })).toBeEnabled()
    expect(appUpdater.status).toHaveBeenCalledOnce()
  })

  it('hands unsupported installs to the release page with their reason', async () => {
    vi.mocked(appUpdater.checkForUpdates).mockResolvedValue({
      ...info,
      supported: false,
      reason: '浏览器预览请从发布页下载安装。',
    })
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    fireEvent.click(await screen.findByRole('button', { name: '检测更新' }))
    expect(await screen.findByText(/浏览器预览请从发布页下载安装/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '前往下载' }))

    await waitFor(() => expect(Browser.OpenURL).toHaveBeenCalledWith(info.releaseURL))
    expect(appUpdater.startUpdate).not.toHaveBeenCalled()
  })

  it('does not start an install from a check that finishes after unmount', async () => {
    let resolveCheck!: (value: UpdateInfo) => void
    vi.mocked(appUpdater.checkForUpdates).mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve
      }),
    )
    const { unmount } = render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    fireEvent.click(await screen.findByRole('button', { name: '检测更新' }))
    unmount()
    await act(async () => {
      resolveCheck(info)
    })
    expect(appUpdater.startUpdate).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('cleans up update polling when the page unmounts', async () => {
    vi.mocked(appUpdater.status).mockResolvedValueOnce(idle).mockResolvedValue(downloading)
    const { unmount } = render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    await confirmUpdate()
    await screen.findByRole('progressbar', { name: '应用更新进度' })
    unmount()
    const calls = vi.mocked(appUpdater.status).mock.calls.length
    vi.useFakeTimers()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(appUpdater.status).toHaveBeenCalledTimes(calls)
  })

  it('stops progress requests when the update helper is restarting the application', async () => {
    vi.mocked(appUpdater.status)
      .mockResolvedValueOnce(idle)
      .mockResolvedValue({ ...idle, state: 'restarting', message: '更新完成，正在重启' })
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })
    await confirmUpdate()
    expect(await screen.findByText('更新完成，正在重启')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '正在重启' })).toBeDisabled()
    const calls = vi.mocked(appUpdater.status).mock.calls.length
    vi.useFakeTimers()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(appUpdater.status).toHaveBeenCalledTimes(calls)
  })
})
