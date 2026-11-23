import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Events } from '@wailsio/runtime'
import { Button, Checkbox, Modal } from '@/design-system'
import { useAuthStore } from '@/stores/auth'
import { useDesktopStore } from '@/stores/desktop'
import {
  DESKTOP_EVENTS,
  desktopManager,
  extractWailsEventPayload,
  type DesktopNavigatePayload,
} from '@/utils/desktopManager'

/**
 * Coordinates Wails native desktop events (tray quick navigation, session sync for menu bar
 * privacy boundaries, and the ask-on-close confirmation dialog). Renders nothing in Web mode.
 */
export default function DesktopBridge() {
  const navigate = useNavigate()
  const initializeDesktop = useDesktopStore((state) => state.initialize)
  const closePrompt = useDesktopStore((state) => state.closePrompt)
  const resolveClosePrompt = useDesktopStore((state) => state.resolveClosePrompt)
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn)
  const userId = useAuthStore((state) => state.user?.id ?? 0)
  const sessionToken = useAuthStore((state) => state.token)
  const [rememberChoice, setRememberChoice] = useState(false)

  useEffect(() => initializeDesktop(), [initializeDesktop])

  // Sync account and JWT changes to the native privacy boundary, including same-account re-login.
  useEffect(() => {
    if (!desktopManager.isAvailable()) return
    const nextUserId = isLoggedIn && userId > 0 ? userId : 0
    void desktopManager.setSessionUser(nextUserId).catch(() => {})
  }, [isLoggedIn, sessionToken, userId])

  // Route tray / menu bar quick actions and cold-launch JumpList / .desktop actions into React Router.
  useEffect(() => {
    if (!desktopManager.isAvailable()) return () => {}
    let active = true
    void desktopManager
      .consumePendingRoute()
      .then((pendingPath) => {
        if (active && pendingPath) {
          void navigate(pendingPath)
        }
      })
      .catch(() => {})
    const unsubscribe = Events.On(DESKTOP_EVENTS.navigate, (event) => {
      const payload = extractWailsEventPayload<DesktopNavigatePayload>(event)
      if (!payload?.path) return
      void navigate(payload.path)
    })
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [navigate])

  const handleCancel = () => {
    setRememberChoice(false)
    void resolveClosePrompt('cancel', false).catch(() => {})
  }

  const handleChoice = (action: 'minimize_to_tray' | 'quit') => {
    const shouldRemember = rememberChoice
    setRememberChoice(false)
    void resolveClosePrompt(action, shouldRemember).catch(() => {})
  }

  const hideLabel = closePrompt.platform === 'darwin' ? '隐藏到菜单栏' : '隐藏到托盘'

  return (
    <Modal.Root onClose={handleCancel} open={closePrompt.open} size="sm">
      <Modal.Header>关闭珠算</Modal.Header>
      <Modal.Body>
        <div className="settings-modal-body">
          <Checkbox
            checked={rememberChoice}
            onChange={(event) => setRememberChoice(event.target.checked)}
          >
            记住我的选择
          </Checkbox>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleCancel} variant="tertiary">
          取消
        </Button>
        <Button onClick={() => handleChoice('quit')} tone="danger" variant="secondary">
          直接退出
        </Button>
        {closePrompt.traySupported ? (
          <Button onClick={() => handleChoice('minimize_to_tray')} variant="primary">
            {hideLabel}
          </Button>
        ) : null}
      </Modal.Footer>
    </Modal.Root>
  )
}
