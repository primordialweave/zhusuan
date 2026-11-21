import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { notificationApi, type Notification } from '@/api/notification'
import NotificationDetailModal from '@/components/notification/NotificationDetailModal'
import {
  Badge,
  Button,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  Popover,
  Skeleton,
  type ChipTone,
} from '@/design-system'
import { useAuthStore } from '@/stores/auth'

const getNotificationTypeName = (type: number) => {
  if (type === 2) return '活动'
  if (type === 3) return '私信'
  return '系统'
}

const getNotificationTone = (type: number): ChipTone => {
  if (type === 2) return 'accent'
  if (type === 3) return 'info'
  return 'neutral'
}

/** Unread notifications beside the Dock. Without unread items it renders no trigger. */
export default function NotificationEntry() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const userId = useAuthStore((state) => state.user?.id)
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([])
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [lingering, setLingering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadedUserId, setLoadedUserId] = useState<number | null | undefined>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isAuthenticatedRef = useRef(isAuthenticated)
  const isMountedRef = useRef(false)
  const refreshGenerationRef = useRef(0)
  const sessionGenerationRef = useRef(0)
  const pendingReadMutationsRef = useRef(0)

  useLayoutEffect(() => {
    isAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      refreshGenerationRef.current += 1
      sessionGenerationRef.current += 1
    }
  }, [])

  useEffect(() => {
    // Navigation invalidates an anchored popover.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false)
  }, [location.pathname, location.search])

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticatedRef.current || pendingReadMutationsRef.current > 0) return

    const refreshGeneration = ++refreshGenerationRef.current
    const sessionGeneration = sessionGenerationRef.current
    setLoading(true)

    try {
      const [countRes, listRes] = await Promise.all([
        notificationApi.getUnreadCount(),
        notificationApi.list(1, 5),
      ])
      if (
        !isMountedRef.current ||
        !isAuthenticatedRef.current ||
        pendingReadMutationsRef.current > 0 ||
        refreshGeneration !== refreshGenerationRef.current ||
        sessionGeneration !== sessionGenerationRef.current
      ) {
        return
      }
      setUnreadCount(countRes.data.data.count)
      setRecentNotifications(listRes.data.data.list)
    } catch {
      // Notification polling should never break primary navigation.
    } finally {
      if (
        isMountedRef.current &&
        isAuthenticatedRef.current &&
        refreshGeneration === refreshGenerationRef.current &&
        sessionGeneration === sessionGenerationRef.current
      ) {
        setLoading(false)
        setLoadedUserId(userId)
      }
    }
  }, [userId])

  useEffect(() => {
    refreshGenerationRef.current += 1
    sessionGenerationRef.current += 1
    pendingReadMutationsRef.current = 0
    if (!isAuthenticated) return

    const initialRefresh = window.setTimeout(refreshNotifications, 0)
    const interval = window.setInterval(refreshNotifications, 30000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(interval)
      refreshGenerationRef.current += 1
      sessionGenerationRef.current += 1
      pendingReadMutationsRef.current = 0
    }
  }, [isAuthenticated, refreshNotifications])

  const handleNotificationClick = async (item: Notification) => {
    setOpen(false)
    triggerRef.current?.focus()
    setSelectedNotification(item)
    if (item.is_read) return

    const sessionGeneration = sessionGenerationRef.current
    pendingReadMutationsRef.current += 1
    refreshGenerationRef.current += 1
    setLoading(false)

    try {
      await notificationApi.markAsRead(item.id)
      if (
        !isMountedRef.current ||
        !isAuthenticatedRef.current ||
        sessionGeneration !== sessionGenerationRef.current
      ) {
        return
      }

      refreshGenerationRef.current += 1
      setUnreadCount((count) => Math.max(0, count - 1))
      setRecentNotifications((items) =>
        items.map((notification) =>
          notification.id === item.id ? { ...notification, is_read: true } : notification,
        ),
      )
    } catch {
      // Keep showing the detail even if the read marker fails.
    } finally {
      if (sessionGeneration === sessionGenerationRef.current) {
        pendingReadMutationsRef.current = Math.max(0, pendingReadMutationsRef.current - 1)
      }
    }
  }

  // The trigger outlives its popover and detail so focus has somewhere to return, then leaves
  // once focus moves on.
  const initialLoading = isAuthenticated && loadedUserId !== userId
  const showTrigger =
    isAuthenticated &&
    !initialLoading &&
    (unreadCount > 0 || open || selectedNotification !== null || lingering)

  return (
    <>
      {initialLoading ? (
        <div
          aria-busy="true"
          aria-label="正在加载最近通知"
          className="app-notification-entry"
          role="status"
        >
          <Skeleton
            height="var(--ods-control-height-lg)"
            shape="circle"
            width="var(--ods-control-height-lg)"
          />
        </div>
      ) : null}
      {showTrigger ? (
        <Popover.Root
          className="app-notification-entry"
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (nextOpen) void refreshNotifications()
          }}
          open={open}
          placement="top-end"
        >
          <Popover.Trigger>
            <IconButton
              className="app-notification-entry__trigger"
              label={unreadCount > 0 ? `查看通知，${unreadCount} 条未读` : '查看通知'}
              onBlur={() => setLingering(false)}
              ref={triggerRef}
              size="lg"
              variant="secondary"
            >
              <Badge dot invisible={unreadCount === 0} tone="danger">
                <i aria-hidden="true" className="ri-notification-3-line" />
              </Badge>
            </IconButton>
          </Popover.Trigger>

          <Popover.Content
            aria-label="最近通知"
            className="app-notification-entry__menu"
            padding="none"
            role="region"
          >
            <div className="app-notification-entry__header">
              <span>最近通知</span>
              <Button
                onClick={() => {
                  setOpen(false)
                  navigate('/settings?tab=notification')
                }}
                size="sm"
                variant="ghost"
              >
                查看全部
              </Button>
            </div>
            <Divider />
            <div aria-busy={loading} className="app-notification-entry__list">
              {loading && recentNotifications.length === 0 ? (
                <div
                  aria-label="正在加载最近通知"
                  className="app-notification-entry__loading"
                  role="status"
                >
                  <Skeleton height="1rem" width="70%" />
                  <Skeleton height="0.875rem" width="40%" />
                  <Skeleton height="1rem" width="60%" />
                </div>
              ) : recentNotifications.length === 0 ? (
                <EmptyState
                  className="app-notification-entry__empty"
                  headingLevel={4}
                  size="sm"
                  title="暂无通知"
                />
              ) : (
                recentNotifications.map((item, index) => (
                  <Fragment key={item.id}>
                    <Button
                      autoHeight
                      className="app-notification-entry__item"
                      fullWidth
                      onClick={() => handleNotificationClick(item)}
                      variant="ghost"
                    >
                      <span className="app-notification-entry__title">
                        <Chip size="sm" tone={getNotificationTone(item.type)}>
                          {getNotificationTypeName(item.type)}
                        </Chip>
                        <span data-read={item.is_read}>{item.title}</span>
                      </span>
                      <span className="app-notification-entry__time">
                        {new Date(item.create_time).toLocaleDateString()}
                      </span>
                    </Button>
                    {index < recentNotifications.length - 1 ? <Divider /> : null}
                  </Fragment>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Root>
      ) : null}

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => {
          setLingering(true)
          setSelectedNotification(null)
        }}
        open={Boolean(selectedNotification)}
      />
    </>
  )
}
