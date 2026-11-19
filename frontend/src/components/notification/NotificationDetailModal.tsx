import type { Notification } from '@/api/notification'
import { Chip, Modal, type ChipTone } from '@/design-system'

interface NotificationDetailModalProps {
  open: boolean
  notification: Notification | null
  onClose: () => void
}

const typeConfig = (type?: number): { label: string; tone: ChipTone } => {
  if (type === 2) return { label: '活动', tone: 'accent' }
  if (type === 3) return { label: '私信', tone: 'info' }
  return { label: '系统', tone: 'neutral' }
}

export default function NotificationDetailModal({
  open,
  notification,
  onClose,
}: NotificationDetailModalProps) {
  const notificationType = typeConfig(notification?.type)

  return (
    <Modal.Root
      className="notification-detail-modal"
      onClose={onClose}
      open={open}
      scrollBehavior="inside"
      size="md"
    >
      <Modal.Header>通知详情</Modal.Header>
      <Modal.Close label="关闭通知详情" />
      {notification ? (
        <Modal.Body
          aria-label="通知内容"
          className="notification-detail-body"
          role="region"
          tabIndex={0}
        >
          <div className="notification-detail-header">
            <Chip size="sm" tone={notificationType.tone}>
              {notificationType.label}
            </Chip>
            <span className="text-sm text-secondary">
              {notification.is_global === 1 ? '全员通知' : '私信通知'}
            </span>
          </div>
          <h3 className="notification-detail-title">{notification.title}</h3>
          <div className="notification-detail-content">
            <p className="text-secondary whitespace-pre-wrap">{notification.content}</p>
          </div>
          <div className="notification-detail-meta">
            {new Date(notification.create_time).toLocaleString()}
            {notification.sender ? ` · 发送者: ${notification.sender.name}` : ''}
          </div>
        </Modal.Body>
      ) : null}
    </Modal.Root>
  )
}
