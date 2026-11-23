import { create } from 'zustand'
import { Events } from '@wailsio/runtime'
import {
  DAY_CHANGED_DOM_EVENT,
  DESKTOP_EVENTS,
  WINDOW_VISIBILITY_DOM_EVENT,
  desktopManager,
  extractWailsEventPayload,
  type BackupInfo,
  type CloseRequestedPayload,
  type DesktopState,
  type PreferencesPatch,
  type WindowVisibilityPayload,
} from '@/utils/desktopManager'

export interface ClosePromptState {
  open: boolean
  traySupported: boolean
  platform: string
}

interface DesktopStoreState {
  state: DesktopState | null
  loading: boolean
  saving: boolean
  windowHidden: boolean
  closePrompt: ClosePromptState
  initialize: () => () => void
  refreshState: () => Promise<void>
  updatePreferences: (patch: PreferencesPatch) => Promise<DesktopState | null>
  resolveClosePrompt: (
    action: 'minimize_to_tray' | 'quit' | 'cancel',
    remember: boolean,
  ) => Promise<void>
  openAutostartSettings: () => Promise<void>
  sendTestReminder: () => Promise<void>
  runBackupNow: () => Promise<BackupInfo | null>
  openBackupDir: () => Promise<void>
}

const initialClosePrompt: ClosePromptState = {
  open: false,
  traySupported: true,
  platform: '',
}

const applyPrivacyDocumentAttr = (enabled: boolean) => {
  if (typeof document === 'undefined') return
  if (enabled) {
    document.documentElement.dataset.privacyMode = 'on'
  } else {
    delete document.documentElement.dataset.privacyMode
  }
}

const dispatchWindowVisibilityDomEvent = (hidden: boolean) => {
  if (typeof window === 'undefined') return
  document.documentElement.dataset.nativeWindowVisibility = hidden ? 'hidden' : 'visible'
  window.dispatchEvent(new CustomEvent(WINDOW_VISIBILITY_DOM_EVENT, { detail: { hidden } }))
}

// Native events carry accepted state; pending reads must not overwrite it.
let stateRevision = 0
let stateRequest = 0
let preferenceRequest = 0
let pendingPreferenceWrites = 0
let visibilityRevision = 0

const restoreWindowVisibility = (state: DesktopState, revision = visibilityRevision) => {
  if (typeof state.windowHidden !== 'boolean' || revision !== visibilityRevision) return {}
  visibilityRevision += 1
  dispatchWindowVisibilityDomEvent(state.windowHidden)
  return { windowHidden: state.windowHidden }
}

export const useDesktopStore = create<DesktopStoreState>((set, get) => ({
  state: null,
  loading: false,
  saving: false,
  windowHidden: false,
  closePrompt: initialClosePrompt,

  initialize() {
    if (!desktopManager.isAvailable()) return () => {}

    let active = true
    const offState = Events.On(DESKTOP_EVENTS.stateChanged, (event) => {
      if (!active) return
      const next = extractWailsEventPayload<DesktopState>(event)
      if (!next) return
      stateRevision += 1
      stateRequest += 1
      applyPrivacyDocumentAttr(next.preferences.privacyMode)
      set({ state: next, loading: false, ...restoreWindowVisibility(next) })
    })

    const offClose = Events.On(DESKTOP_EVENTS.closeRequested, (event) => {
      if (!active) return
      const payload = extractWailsEventPayload<CloseRequestedPayload>(event)
      set({
        closePrompt: {
          open: true,
          traySupported: payload?.traySupported ?? get().state?.capabilities.traySupported ?? true,
          platform: payload?.platform ?? get().state?.capabilities.platform ?? '',
        },
      })
    })

    const offVisibility = Events.On(DESKTOP_EVENTS.windowVisibility, (event) => {
      if (!active) return
      const payload = extractWailsEventPayload<WindowVisibilityPayload>(event)
      const hidden = Boolean(payload?.hidden)
      visibilityRevision += 1
      set({ windowHidden: hidden })
      dispatchWindowVisibilityDomEvent(hidden)
    })

    const offDayChanged = Events.On(DESKTOP_EVENTS.dayChanged, (event) => {
      if (!active || typeof window === 'undefined') return
      const payload = extractWailsEventPayload<{ date?: string }>(event)
      window.dispatchEvent(new CustomEvent(DAY_CHANGED_DOM_EVENT, { detail: payload }))
    })

    void get().refreshState()

    return () => {
      active = false
      stateRevision += 1
      stateRequest += 1
      set({ loading: false })
      offState?.()
      offClose?.()
      offVisibility?.()
      offDayChanged?.()
    }
  },

  async refreshState() {
    if (!desktopManager.isAvailable()) return
    const request = ++stateRequest
    const revision = stateRevision
    const visibility = visibilityRevision
    set({ loading: true })
    try {
      const next = await desktopManager.getState()
      if (request !== stateRequest || revision !== stateRevision) return
      stateRevision += 1
      applyPrivacyDocumentAttr(next.preferences.privacyMode)
      set({ state: next, loading: false, ...restoreWindowVisibility(next, visibility) })
    } catch {
      if (request === stateRequest) set({ loading: false })
    }
  },

  async updatePreferences(patch) {
    if (!desktopManager.isAvailable()) return null
    const request = ++preferenceRequest
    const revision = stateRevision
    const visibility = visibilityRevision
    stateRequest += 1
    pendingPreferenceWrites += 1
    set({ saving: true, loading: false })
    try {
      const next = await desktopManager.updatePreferences(patch)
      if (request === preferenceRequest && revision === stateRevision) {
        stateRevision += 1
        applyPrivacyDocumentAttr(next.preferences.privacyMode)
        set({ state: next, ...restoreWindowVisibility(next, visibility) })
      }
      return next
    } finally {
      pendingPreferenceWrites -= 1
      set({ saving: pendingPreferenceWrites > 0 })
    }
  },

  async resolveClosePrompt(action, remember) {
    set({ closePrompt: initialClosePrompt })
    if (!desktopManager.isAvailable()) return
    await desktopManager.resolveClosePrompt(action, remember)
  },

  async openAutostartSettings() {
    if (!desktopManager.isAvailable()) return
    await desktopManager.openAutostartSettings()
  },

  async sendTestReminder() {
    if (!desktopManager.isAvailable()) return
    await desktopManager.sendTestReminder()
  },

  async runBackupNow() {
    if (!desktopManager.isAvailable()) return null
    return desktopManager.runBackupNow()
  },

  async openBackupDir() {
    if (!desktopManager.isAvailable()) return
    await desktopManager.openBackupDir()
  },
}))

export const usePrivacyMode = (): boolean =>
  useDesktopStore((store) => store.state?.preferences.privacyMode ?? false)
