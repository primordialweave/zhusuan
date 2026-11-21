import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { JadeIcon, type JadeIconName } from '../icon'
import { dismissToast, getToasts, subscribeToasts, type ToastTone } from './toastStore'

const ICON_BY_TONE: Record<ToastTone, JadeIconName> = {
  success: 'check-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'info',
}

export interface ToasterProps {
  dismissLabel?: string
}

export function Toaster({ dismissLabel = '点击关闭' }: ToasterProps) {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div aria-live="polite" className="ods-toaster" data-slot="toaster" role="status">
      {toasts.map((item) => (
        <button
          aria-label={`${item.message}（${dismissLabel}）`}
          className="ods-toast"
          data-slot="toast"
          data-tone={item.tone}
          key={item.id}
          onClick={() => dismissToast(item.id)}
          type="button"
        >
          <span aria-hidden="true" className="ods-toast__icon" data-slot="icon">
            <JadeIcon name={ICON_BY_TONE[item.tone]} size="1em" />
          </span>
          <span className="ods-toast__message" data-slot="message">
            {item.message}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
