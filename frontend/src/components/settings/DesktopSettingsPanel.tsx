import { useId, useState } from 'react'
import SettingsGroup from '@/components/settings/SettingsGroup'
import { useToast } from '@/composables/useToast'
import { Button, Select, Skeleton, Switch, type SelectOption } from '@/design-system'
import { useDesktopStore } from '@/stores/desktop'
import type {
  CloseAction,
  MenuBarDisplay,
  PreferencesPatch,
  TrayClickAction,
} from '@/utils/desktopManager'

const SHORTCUT_NONE = '__none__'

const MENU_BAR_DISPLAY_OPTIONS: SelectOption[] = [
  { label: '仅图标', value: 'icon' },
  { label: '待办 / 逾期笔数', value: 'pending_count' },
  { label: '本月实收金额', value: 'month_received' },
  { label: '累计待收金额', value: 'total_pending' },
]

const TRAY_CLICK_OPTIONS: SelectOption[] = [
  { label: '切换主窗口', value: 'toggle_window' },
  { label: '打开快捷菜单', value: 'open_menu' },
]

const REMINDER_TIME_OPTIONS: SelectOption[] = [
  { label: '08:30', value: '08:30' },
  { label: '09:00', value: '09:00' },
  { label: '09:30', value: '09:30' },
  { label: '10:00', value: '10:00' },
  { label: '14:00', value: '14:00' },
  { label: '18:00', value: '18:00' },
]

const BACKUP_RETENTION_OPTIONS: SelectOption[] = [
  { label: '最近 3 份', value: '3' },
  { label: '最近 7 份', value: '7' },
  { label: '最近 14 份', value: '14' },
  { label: '最近 30 份', value: '30' },
]

const formatShortcutLabel = (accelerator: string, isMac: boolean): string => {
  if (!accelerator) return '关闭'
  if (isMac) {
    return accelerator
      .replace(/CmdOrCtrl\+/gi, '⌘')
      .replace(/Shift\+/gi, '⇧')
      .replace(/Alt\+/gi, '⌥')
      .replace(/Option\+/gi, '⌥')
  }
  return accelerator.replace(/CmdOrCtrl\+/gi, 'Ctrl+').replace(/Option\+/gi, 'Alt+')
}

const buildShortcutOptions = (
  presets: readonly string[],
  current: string,
  isMac: boolean,
): SelectOption[] => {
  const unique = new Set<string>(presets)
  if (current) unique.add(current)
  return [
    { label: '关闭', value: SHORTCUT_NONE },
    ...[...unique].map((accel) => ({
      label: formatShortcutLabel(accel, isMac),
      value: accel,
    })),
  ]
}

export default function DesktopSettingsPanel() {
  const rowId = useId()
  const toast = useToast()
  const state = useDesktopStore((store) => store.state)
  const loading = useDesktopStore((store) => store.loading)
  const saving = useDesktopStore((store) => store.saving)
  const updatePreferences = useDesktopStore((store) => store.updatePreferences)
  const openAutostartSettings = useDesktopStore((store) => store.openAutostartSettings)
  const sendTestReminder = useDesktopStore((store) => store.sendTestReminder)
  const runBackupNow = useDesktopStore((store) => store.runBackupNow)
  const openBackupDir = useDesktopStore((store) => store.openBackupDir)
  const [testingReminder, setTestingReminder] = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)

  if (!state && loading) {
    return (
      <div className="settings-page" aria-busy="true" role="status">
        <SettingsGroup flush title="启动与关闭">
          <ul className="settings-list">
            {[0, 1, 2].map((index) => (
              <li className="settings-row" key={index}>
                <Skeleton height="1rem" width="8rem" />
                <Skeleton height="1.5rem" width="3rem" />
              </li>
            ))}
          </ul>
        </SettingsGroup>
      </div>
    )
  }

  if (!state) return null

  const { autostart, capabilities, preferences } = state
  const isMac = capabilities.platform === 'darwin'
  const hideTargetLabel = isMac ? '隐藏到菜单栏' : '隐藏到托盘'

  const closeOptions: SelectOption[] = [
    { label: '每次询问', value: 'ask' },
    ...(capabilities.traySupported ? [{ label: hideTargetLabel, value: 'minimize_to_tray' }] : []),
    { label: '直接退出', value: 'quit' },
  ]

  const reminderTimeOptions = REMINDER_TIME_OPTIONS.some(
    (item) => item.value === preferences.reminderTime,
  )
    ? REMINDER_TIME_OPTIONS
    : [...REMINDER_TIME_OPTIONS, { label: preferences.reminderTime, value: preferences.reminderTime }]

  const toggleShortcutOptions = buildShortcutOptions(
    ['CmdOrCtrl+Shift+Z', 'CmdOrCtrl+Alt+Z', 'CmdOrCtrl+Shift+J'],
    preferences.toggleWindowShortcut,
    isMac,
  )
  const receiptShortcutOptions = buildShortcutOptions(
    ['CmdOrCtrl+Shift+N', 'CmdOrCtrl+Alt+N', 'CmdOrCtrl+Shift+R'],
    preferences.quickReceiptShortcut,
    isMac,
  )
  const privacyShortcutOptions = buildShortcutOptions(
    ['CmdOrCtrl+Shift+P', 'CmdOrCtrl+Alt+P', 'CmdOrCtrl+Shift+H'],
    preferences.privacyModeShortcut,
    isMac,
  )

  const applyPatch = async (patch: PreferencesPatch) => {
    try {
      await updatePreferences(patch)
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '保存桌面设置失败')
    }
  }

  const handleTestReminder = async () => {
    if (testingReminder) return
    setTestingReminder(true)
    try {
      await sendTestReminder()
      toast.success('已发送测试提醒')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '发送测试提醒失败')
    } finally {
      setTestingReminder(false)
    }
  }

  const handleRunBackupNow = async () => {
    if (runningBackup) return
    setRunningBackup(true)
    try {
      const info = await runBackupNow()
      toast.success(info ? `已备份 ${info.fileName}` : '本地快照备份已完成')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '本地快照备份失败')
    } finally {
      setRunningBackup(false)
    }
  }

  const handleOpenBackupDir = async () => {
    try {
      await openBackupDir()
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : '无法打开备份目录')
    }
  }

  const backupRetentionValue = String(preferences.autoBackupRetention || 7)
  const backupRetentionOptions = BACKUP_RETENTION_OPTIONS.some(
    (item) => item.value === backupRetentionValue,
  )
    ? BACKUP_RETENTION_OPTIONS
    : [...BACKUP_RETENTION_OPTIONS, { label: `最近 ${backupRetentionValue} 份`, value: backupRetentionValue }]

  return (
    <div className="settings-page">
      <SettingsGroup flush title="启动与关闭">
        <ul className="settings-list">
          {capabilities.autostartSupported ? (
            <li className="settings-row">
              <span className="settings-row__title" id={`${rowId}-autostart`}>
                开机自动启动
              </span>
              <div className="settings-row__value">
                {autostart.requiresApproval ? (
                  <Button
                    onClick={() => void openAutostartSettings()}
                    size="sm"
                    variant="secondary"
                  >
                    登录项授权
                  </Button>
                ) : null}
                <Switch
                  aria-labelledby={`${rowId}-autostart`}
                  checked={preferences.autostart}
                  disabled={saving}
                  onChange={(event) => void applyPatch({ autostart: event.target.checked })}
                />
              </div>
            </li>
          ) : null}

          {capabilities.autostartSupported && capabilities.traySupported ? (
            <li className="settings-row">
              <span className="settings-row__title" id={`${rowId}-start-hidden`}>
                开机启动时隐藏到后台
              </span>
              <Switch
                aria-labelledby={`${rowId}-start-hidden`}
                checked={preferences.startHidden}
                disabled={saving || !preferences.autostart}
                onChange={(event) => void applyPatch({ startHidden: event.target.checked })}
              />
            </li>
          ) : null}

          <li className="settings-row">
            <span className="settings-row__title" id={`${rowId}-close-action`}>
              点击关闭按钮
            </span>
            <Select
              aria-labelledby={`${rowId}-close-action`}
              clearable={false}
              disabled={saving}
              onValueChange={(value) => void applyPatch({ closeAction: value as CloseAction })}
              options={closeOptions}
              size="sm"
              value={preferences.closeAction}
              width="content"
            />
          </li>

          <li className="settings-row">
            <span className="settings-row__title" id={`${rowId}-remember-bounds`}>
              记住窗口大小与位置
            </span>
            <Switch
              aria-labelledby={`${rowId}-remember-bounds`}
              checked={preferences.rememberWindowBounds}
              disabled={saving}
              onChange={(event) => void applyPatch({ rememberWindowBounds: event.target.checked })}
            />
          </li>

          {capabilities.hideDockSupported ? (
            <li className="settings-row">
              <span className="settings-row__title" id={`${rowId}-hide-dock`}>
                隐藏窗口时隐藏 Dock 图标
              </span>
              <Switch
                aria-labelledby={`${rowId}-hide-dock`}
                checked={preferences.hideDockWhenMinimized}
                disabled={saving}
                onChange={(event) =>
                  void applyPatch({ hideDockWhenMinimized: event.target.checked })
                }
              />
            </li>
          ) : null}
        </ul>
      </SettingsGroup>

      {capabilities.traySupported ? (
        <SettingsGroup flush title={isMac ? '菜单栏' : '系统托盘'}>
          <ul className="settings-list">
            {capabilities.menuBarLabelSupported ? (
              <li className="settings-row">
                <span className="settings-row__title" id={`${rowId}-menubar-display`}>
                  顶部菜单栏显示
                </span>
                <Select
                  aria-labelledby={`${rowId}-menubar-display`}
                  clearable={false}
                  disabled={saving}
                  onValueChange={(value) =>
                    void applyPatch({ menuBarDisplay: value as MenuBarDisplay })
                  }
                  options={MENU_BAR_DISPLAY_OPTIONS}
                  size="sm"
                  value={preferences.menuBarDisplay}
                  width="content"
                />
              </li>
            ) : null}

            <li className="settings-row">
              <span className="settings-row__title" id={`${rowId}-privacy-mode`}>
                隐私模式（隐藏金额）
              </span>
              <Switch
                aria-labelledby={`${rowId}-privacy-mode`}
                checked={preferences.privacyMode}
                disabled={saving}
                onChange={(event) => void applyPatch({ privacyMode: event.target.checked })}
              />
            </li>

            {capabilities.trayClickActionSupported ? (
              <li className="settings-row">
                <span className="settings-row__title" id={`${rowId}-tray-click`}>
                  单击托盘图标
                </span>
                <Select
                  aria-labelledby={`${rowId}-tray-click`}
                  clearable={false}
                  disabled={saving}
                  onValueChange={(value) =>
                    void applyPatch({ trayClickAction: value as TrayClickAction })
                  }
                  options={TRAY_CLICK_OPTIONS}
                  size="sm"
                  value={preferences.trayClickAction}
                  width="content"
                />
              </li>
            ) : null}
          </ul>
        </SettingsGroup>
      ) : null}

      {capabilities.notificationsSupported || capabilities.globalShortcutsSupported ? (
        <SettingsGroup flush title="提醒与快捷键">
          <ul className="settings-list">
            {capabilities.notificationsSupported ? (
              <>
                <li className="settings-row">
                  <span className="settings-row__title" id={`${rowId}-reminder-enabled`}>
                    收款到期桌面提醒
                  </span>
                  <div className="settings-row__value">
                    {preferences.reminderEnabled ? (
                      <Button
                        disabled={testingReminder}
                        onClick={() => void handleTestReminder()}
                        size="sm"
                        variant="secondary"
                      >
                        测试提醒
                      </Button>
                    ) : null}
                    <Switch
                      aria-labelledby={`${rowId}-reminder-enabled`}
                      checked={preferences.reminderEnabled}
                      disabled={saving}
                      onChange={(event) =>
                        void applyPatch({ reminderEnabled: event.target.checked })
                      }
                    />
                  </div>
                </li>

                <li className="settings-row">
                  <span className="settings-row__title" id={`${rowId}-reminder-time`}>
                    每日提醒时间
                  </span>
                  <Select
                    aria-labelledby={`${rowId}-reminder-time`}
                    clearable={false}
                    disabled={saving || !preferences.reminderEnabled}
                    onValueChange={(value) => void applyPatch({ reminderTime: value })}
                    options={reminderTimeOptions}
                    size="sm"
                    value={preferences.reminderTime}
                    width="content"
                  />
                </li>
              </>
            ) : null}

            {capabilities.globalShortcutsSupported ? (
              <>
                <li className="settings-row">
                  <span className="settings-row__title" id={`${rowId}-shortcut-toggle`}>
                    唤起 / 隐藏主窗口
                  </span>
                  <Select
                    aria-labelledby={`${rowId}-shortcut-toggle`}
                    clearable={false}
                    disabled={saving}
                    onValueChange={(value) =>
                      void applyPatch({
                        toggleWindowShortcut: value === SHORTCUT_NONE ? '' : value,
                      })
                    }
                    options={toggleShortcutOptions}
                    size="sm"
                    value={preferences.toggleWindowShortcut || SHORTCUT_NONE}
                    width="content"
                  />
                </li>

                <li className="settings-row">
                  <span className="settings-row__title" id={`${rowId}-shortcut-receipt`}>
                    极速记一笔收款
                  </span>
                  <Select
                    aria-labelledby={`${rowId}-shortcut-receipt`}
                    clearable={false}
                    disabled={saving}
                    onValueChange={(value) =>
                      void applyPatch({
                        quickReceiptShortcut: value === SHORTCUT_NONE ? '' : value,
                      })
                    }
                    options={receiptShortcutOptions}
                    size="sm"
                    value={preferences.quickReceiptShortcut || SHORTCUT_NONE}
                    width="content"
                  />
                </li>

                <li className="settings-row">
                  <span className="settings-row__title" id={`${rowId}-shortcut-privacy`}>
                    一键切换隐私模式
                  </span>
                  <Select
                    aria-labelledby={`${rowId}-shortcut-privacy`}
                    clearable={false}
                    disabled={saving}
                    onValueChange={(value) =>
                      void applyPatch({
                        privacyModeShortcut: value === SHORTCUT_NONE ? '' : value,
                      })
                    }
                    options={privacyShortcutOptions}
                    size="sm"
                    value={preferences.privacyModeShortcut || SHORTCUT_NONE}
                    width="content"
                  />
                </li>
              </>
            ) : null}
          </ul>
        </SettingsGroup>
      ) : null}

      {capabilities.autoBackupSupported ? (
        <SettingsGroup flush title="本地账本备份">
          <ul className="settings-list">
            <li className="settings-row">
              <span className="settings-row__title" id={`${rowId}-auto-backup`}>
                每日自动快照备份
              </span>
              <div className="settings-row__value">
                <Button
                  disabled={runningBackup}
                  onClick={() => void handleRunBackupNow()}
                  size="sm"
                  variant="secondary"
                >
                  立即备份
                </Button>
                <Button
                  onClick={() => void handleOpenBackupDir()}
                  size="sm"
                  variant="tertiary"
                >
                  打开目录
                </Button>
                <Switch
                  aria-labelledby={`${rowId}-auto-backup`}
                  checked={preferences.autoBackupEnabled}
                  disabled={saving}
                  onChange={(event) => void applyPatch({ autoBackupEnabled: event.target.checked })}
                />
              </div>
            </li>

            <li className="settings-row">
              <span className="settings-row__title" id={`${rowId}-backup-retention`}>
                保留快照份数
              </span>
              <Select
                aria-labelledby={`${rowId}-backup-retention`}
                clearable={false}
                disabled={saving}
                onValueChange={(value) =>
                  void applyPatch({ autoBackupRetention: Number(value) || 7 })
                }
                options={backupRetentionOptions}
                size="sm"
                value={backupRetentionValue}
                width="content"
              />
            </li>
          </ul>
        </SettingsGroup>
      ) : null}
    </div>
  )
}
