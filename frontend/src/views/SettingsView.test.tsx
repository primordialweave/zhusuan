import { useEffect, type ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/api/auth'
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, useAppearanceStore } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { render, screen, waitFor, within } from '@/test/render'
import SettingsView from './SettingsView'

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

  it('offers the theme as one segmented choice that stays synchronized with the theme store', async () => {
    const user = userEvent.setup()
    render(<SettingsView />, { initialEntries: ['/settings?tab=appearance'] })

    const tabs = screen.getByRole('tablist', { name: '设置分类' })
    expect(tabs).toHaveClass('ods-tabs__list')
    expect(tabs).toHaveAttribute('data-variant', 'underline')

    const theme = screen.getByRole('radiogroup', { name: '界面主题' })
    expect(theme).toHaveClass('ods-segmented-control')
    expect(
      within(theme)
        .getAllByRole('radio')
        .map((option) => option.textContent),
    ).toEqual(['浅色', '深色', '跟随系统'])
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
    expect(reduce).toHaveAccessibleDescription('保留静态雨景，减少背景动效')

    await user.click(reduce)
    await user.click(glass)

    expect(useAppearanceStore.getState()).toMatchObject({ liquidGlass: false, reduceMotion: true })
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
    expect(document.documentElement).toHaveAttribute('data-glass', 'solid')
    expect(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}')).toEqual({
      liquidGlass: false,
      reduceMotion: true,
      sceneMotion: true,
    })
    expect(screen.getByRole('img', { name: '江南场景预览' })).toBeInTheDocument()
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
    expect(screen.getByText('管理账户和界面偏好')).toBeInTheDocument()
    expect(screen.queryByLabelText('设置导航')).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '个人信息',
      '安全设置',
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

    act(() => routeNavigate?.('/settings?tab=security'))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '安全设置' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
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

  it('keeps password change behavior behind ODS tabs, fields, and actions', async () => {
    const changePassword = vi.fn().mockResolvedValue(true)
    useAuthStore.setState({ changePassword })
    const user = userEvent.setup()
    render(<SettingsView />, { initialEntries: ['/settings?tab=profile'] })

    await user.click(screen.getByRole('tab', { name: '安全设置' }))
    await user.type(screen.getByLabelText('当前密码'), 'old-secret')
    await user.type(screen.getByLabelText('新密码'), 'new-secret')
    await user.type(screen.getByLabelText('确认新密码'), 'new-secret')
    await user.click(screen.getByRole('button', { name: '修改密码' }))

    expect(changePassword).toHaveBeenCalledWith('old-secret', 'new-secret')
  })

  it('lists the About facts as rows and opens the repository from an ODS button', () => {
    render(<SettingsView />, { initialEntries: ['/settings?tab=about'] })

    expect(screen.getByRole('heading', { level: 2, name: 'Orange' })).toBeInTheDocument()
    const repository = screen.getByRole('button', { name: 'FruitsAI/Orange' })
    expect(repository).toHaveClass('ods-button')
    expect(repository).toHaveAccessibleDescription('开源地址')
    expect(screen.getByRole('button', { name: '检测更新' })).toHaveClass('ods-button')
    expect(document.querySelector('.ods-card')).toBeNull()
  })
})
