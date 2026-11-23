import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Call } from '@wailsio/runtime'
import DesktopSettingsPanel from './DesktopSettingsPanel'
import { useDesktopStore } from '@/stores/desktop'
import type { DesktopState } from '@/utils/desktopManager'

const makeState = (overrides?: Partial<DesktopState>): DesktopState => ({
  preferences: {
    autostart: false,
    startHidden: false,
    closeAction: 'ask',
    menuBarDisplay: 'pending_count',
    privacyMode: false,
    hideDockWhenMinimized: false,
    rememberWindowBounds: true,
    trayClickAction: 'toggle_window',
    reminderEnabled: false,
    reminderTime: '09:30',
    toggleWindowShortcut: '',
    quickReceiptShortcut: '',
    privacyModeShortcut: '',
    autoBackupEnabled: false,
    autoBackupRetention: 7,
  },
  autostart: {
    enabled: false,
    supported: true,
    requiresApproval: false,
    strategy: 'smappservice',
  },
  capabilities: {
    platform: 'darwin',
    autostartSupported: true,
    traySupported: true,
    menuBarLabelSupported: true,
    hideDockSupported: true,
    trayClickActionSupported: false,
    notificationsSupported: true,
    globalShortcutsSupported: true,
    autoBackupSupported: true,
  },
  ...overrides,
})

describe('DesktopSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as Window & { _wails?: { environment?: { OS?: string } } })._wails = {
      environment: { OS: 'darwin' },
    }
    useDesktopStore.setState({
      state: makeState(),
      loading: false,
      saving: false,
      windowHidden: false,
      closePrompt: { open: false, traySupported: true, platform: 'darwin' },
    })
  })

  it('renders macOS-specific controls (menu bar display, hide Dock, approval CTA) and omits Windows-only controls', async () => {
    const nextState = makeState({
      preferences: { ...makeState().preferences, autostart: true },
      autostart: {
        enabled: false,
        supported: true,
        requiresApproval: true,
        strategy: 'smappservice',
      },
    })
    useDesktopStore.setState({ state: nextState })
    vi.mocked(Call.ByName).mockResolvedValueOnce(undefined as never)

    render(<DesktopSettingsPanel />)

    expect(screen.getByText('开机自动启动')).toBeInTheDocument()
    expect(screen.getByText('顶部菜单栏显示')).toBeInTheDocument()
    expect(screen.getByText('隐藏窗口时隐藏 Dock 图标')).toBeInTheDocument()
    expect(screen.queryByText('单击托盘图标')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '登录项授权' }))
    await waitFor(() => {
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.OpenAutostartSettings',
      )
    })
  })

  it('renders Windows tray click action and hides macOS-only menu bar & Dock controls', () => {
    ;(window as Window & { _wails?: { environment?: { OS?: string } } })._wails = {
      environment: { OS: 'windows' },
    }
    useDesktopStore.setState({
      state: makeState({
        capabilities: {
          platform: 'windows',
          autostartSupported: true,
          traySupported: true,
          menuBarLabelSupported: false,
          hideDockSupported: false,
          trayClickActionSupported: true,
          notificationsSupported: true,
          globalShortcutsSupported: true,
          autoBackupSupported: true,
        },
      }),
    })

    render(<DesktopSettingsPanel />)

    expect(screen.getByText('系统托盘')).toBeInTheDocument()
    expect(screen.getByText('单击托盘图标')).toBeInTheDocument()
    expect(screen.queryByText('顶部菜单栏显示')).not.toBeInTheDocument()
    expect(screen.queryByText('隐藏窗口时隐藏 Dock 图标')).not.toBeInTheDocument()
  })

  it('hides tray section and start-hidden option on trayless Linux desktops', () => {
    ;(window as Window & { _wails?: { environment?: { OS?: string } } })._wails = {
      environment: { OS: 'linux' },
    }
    useDesktopStore.setState({
      state: makeState({
        capabilities: {
          platform: 'linux',
          autostartSupported: true,
          traySupported: false,
          menuBarLabelSupported: false,
          hideDockSupported: false,
          trayClickActionSupported: false,
          notificationsSupported: true,
          globalShortcutsSupported: true,
          autoBackupSupported: true,
        },
      }),
    })

    render(<DesktopSettingsPanel />)

    expect(screen.queryByText('开机启动时隐藏到后台')).not.toBeInTheDocument()
    expect(screen.queryByText('系统托盘')).not.toBeInTheDocument()
    expect(screen.getByText('点击关闭按钮')).toBeInTheDocument()
  })

  it('sends preference patch to DesktopManager when toggling autostart', async () => {
    const updated = makeState({
      preferences: { ...makeState().preferences, autostart: true },
      autostart: {
        enabled: true,
        supported: true,
        requiresApproval: false,
        strategy: 'smappservice',
      },
    })
    vi.mocked(Call.ByName).mockResolvedValueOnce(updated as never)

    render(<DesktopSettingsPanel />)
    const autostartSwitch = screen.getByRole('switch', { name: '开机自动启动' })
    fireEvent.click(autostartSwitch)

    await waitFor(() => {
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.UpdatePreferences',
        { autostart: true },
      )
    })
  })

  it('triggers native test notification when reminder is enabled', async () => {
    useDesktopStore.setState({
      state: makeState({
        preferences: { ...makeState().preferences, reminderEnabled: true },
      }),
    })
    vi.mocked(Call.ByName).mockResolvedValueOnce(undefined as never)

    render(<DesktopSettingsPanel />)
    expect(screen.getByText('提醒与快捷键')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '测试提醒' }))

    await waitFor(() => {
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.SendTestReminder',
      )
    })
  })

  it('triggers immediate SQLite backup and opens backup directory when supported', async () => {
    vi.mocked(Call.ByName)
      .mockResolvedValueOnce({
        fileName: 'zhusuan-auto-20261123-135000.db',
        path: '/tmp/backups/zhusuan-auto-20261123-135000.db',
        sizeBytes: 4096,
        createdAt: '2026-11-23T13:50:00+08:00',
        count: 1,
        backupDir: '/tmp/backups',
      } as never)
      .mockResolvedValueOnce(undefined as never)

    render(<DesktopSettingsPanel />)
    expect(screen.getByText('本地账本备份')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '立即备份' }))
    await waitFor(() => {
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.RunBackupNow',
      )
    })

    fireEvent.click(screen.getByRole('button', { name: '打开目录' }))
    await waitFor(() => {
      expect(Call.ByName).toHaveBeenCalledWith(
        'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager.OpenBackupDir',
      )
    })
  })
})
