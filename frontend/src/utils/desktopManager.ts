import { Call } from '@wailsio/runtime'
import { getStoredToken } from './authStorage'

export type DesktopPlatform = 'darwin' | 'windows' | 'linux'
export type CloseAction = 'ask' | 'minimize_to_tray' | 'quit'
export type MenuBarDisplay = 'icon' | 'pending_count' | 'month_received' | 'total_pending'
export type TrayClickAction = 'toggle_window' | 'open_menu'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximised: boolean
  valid: boolean
}

export interface DesktopPreferences {
  autostart: boolean
  startHidden: boolean
  closeAction: CloseAction
  menuBarDisplay: MenuBarDisplay
  privacyMode: boolean
  hideDockWhenMinimized: boolean
  rememberWindowBounds: boolean
  trayClickAction: TrayClickAction
  reminderEnabled: boolean
  reminderTime: string
  lastReminderDate?: string
  toggleWindowShortcut: string
  quickReceiptShortcut: string
  privacyModeShortcut: string
  autoBackupEnabled: boolean
  autoBackupRetention: number
  lastBackupDate?: string
  windowBounds?: WindowBounds
}

export interface BackupInfo {
  fileName: string
  path: string
  sizeBytes: number
  createdAt: string
  count: number
  backupDir: string
}

export type MenuBarScope = 'month' | 'year' | 'all'

export interface MenuBarTrendPoint {
  label: string
  amount: number
}

export interface MenuBarUpcomingItem {
  paymentId: number
  projectId: number
  projectName: string
  stage: string
  amount: number
  planDate: string
  overdue: boolean
}

export interface MenuBarSnapshot {
  loggedIn: boolean
  scope: MenuBarScope
  periodReceived: number
  contractTotal: number
  contractReceived: number
  totalPending: number
  overdueAmount: number
  overdueCount: number
  upcomingCount: number
  privacyMode: boolean
  trend: MenuBarTrendPoint[]
  items: MenuBarUpcomingItem[]
}

export interface AutostartState {
  enabled: boolean
  supported: boolean
  requiresApproval: boolean
  strategy: string
  path?: string
  error?: string
}

export interface DesktopCapabilities {
  platform: DesktopPlatform | string
  autostartSupported: boolean
  traySupported: boolean
  menuBarLabelSupported: boolean
  hideDockSupported: boolean
  trayClickActionSupported: boolean
  notificationsSupported: boolean
  globalShortcutsSupported: boolean
  autoBackupSupported: boolean
}

export interface DesktopState {
  preferences: DesktopPreferences
  autostart: AutostartState
  capabilities: DesktopCapabilities
  windowHidden?: boolean
}

export interface PreferencesPatch {
  autostart?: boolean
  startHidden?: boolean
  closeAction?: CloseAction
  menuBarDisplay?: MenuBarDisplay
  privacyMode?: boolean
  hideDockWhenMinimized?: boolean
  rememberWindowBounds?: boolean
  trayClickAction?: TrayClickAction
  reminderEnabled?: boolean
  reminderTime?: string
  toggleWindowShortcut?: string
  quickReceiptShortcut?: string
  privacyModeShortcut?: string
  autoBackupEnabled?: boolean
  autoBackupRetention?: number
}

export interface CloseRequestedPayload {
  traySupported: boolean
  platform: string
}

export interface DesktopNavigatePayload {
  path: string
}

export interface WindowVisibilityPayload {
  hidden: boolean
}

export const DESKTOP_EVENTS = {
  closeRequested: 'desktop:close-requested',
  dayChanged: 'desktop:day-changed',
  menuBarUpdated: 'desktop:menubar-updated',
  navigate: 'desktop:navigate',
  stateChanged: 'desktop:state-changed',
  windowVisibility: 'desktop:window-visibility',
} as const

export const WINDOW_VISIBILITY_DOM_EVENT = 'zhusuan:window-visibility'
export const DAY_CHANGED_DOM_EVENT = 'zhusuan:day-changed'

const serviceName = 'github.com/primordialweave/zhusuan/internal/desktop.DesktopManager'

type WailsWindow = Window & {
  _wails?: { environment?: { OS?: string } }
  __WAILS__?: { environment?: { OS?: string } }
}

export const getDesktopPlatform = (): DesktopPlatform | null => {
  if (typeof window === 'undefined') return null
  const runtime = window as WailsWindow
  const os = runtime._wails?.environment?.OS ?? runtime.__WAILS__?.environment?.OS
  if (os === 'darwin' || os === 'windows' || os === 'linux') return os
  return null
}

export const isDesktopRuntime = (): boolean => getDesktopPlatform() !== null

export const extractWailsEventPayload = <T>(event: unknown): T | null => {
  if (!event || typeof event !== 'object') return null
  const raw = 'data' in event ? (event as { data?: unknown }).data : event
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null
  return (raw as T | undefined) ?? null
}

export const desktopManager = {
  isAvailable: isDesktopRuntime,

  getState: (): Promise<DesktopState> => Call.ByName(`${serviceName}.GetState`),

  updatePreferences: (patch: PreferencesPatch): Promise<DesktopState> =>
    Call.ByName(`${serviceName}.UpdatePreferences`, patch),

  resolveClosePrompt: (
    action: 'minimize_to_tray' | 'quit' | 'cancel',
    remember: boolean,
  ): Promise<void> => Call.ByName(`${serviceName}.ResolveClosePrompt`, action, remember),

  setSessionUser: (userId: number): Promise<void> =>
    Call.ByName(`${serviceName}.SetSessionUser`, userId, userId > 0 ? getStoredToken() || '' : ''),

  refreshTraySummary: (): Promise<void> => Call.ByName(`${serviceName}.RefreshTraySummary`),

  openAutostartSettings: (): Promise<void> => Call.ByName(`${serviceName}.OpenAutostartSettings`),

  sendTestReminder: (): Promise<void> => Call.ByName(`${serviceName}.SendTestReminder`),

  runBackupNow: (): Promise<BackupInfo> => Call.ByName(`${serviceName}.RunBackupNow`),

  openBackupDir: (): Promise<void> => Call.ByName(`${serviceName}.OpenBackupDir`),

  consumePendingRoute: (): Promise<string> => Call.ByName(`${serviceName}.ConsumePendingRoute`),

  getMenuBarSnapshot: (scope: MenuBarScope): Promise<MenuBarSnapshot> =>
    Call.ByName(`${serviceName}.GetMenuBarSnapshot`, scope),

  openRouteFromMenuBar: (route: string): Promise<void> =>
    Call.ByName(`${serviceName}.OpenRouteFromMenuBar`, route),

  hideMenuBarPopover: (): Promise<void> => Call.ByName(`${serviceName}.HideMenuBarPopover`),

  requestQuit: (): Promise<void> => Call.ByName(`${serviceName}.RequestQuit`),
}
