import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { notificationApi, type Notification, type UserBrief } from '@/api/notification'
import NotificationDetailModal from '@/components/notification/NotificationDetailModal'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/composables/useToast'
import {
  Alert,
  Button,
  Chip,
  EmptyScene,
  EmptyState,
  Field,
  FormActions,
  IconButton,
  Input,
  JadeIcon,
  Modal,
  PaginationBar,
  Select,
  Skeleton,
  TextArea,
} from '@/design-system'
import { SettingsListSkeleton } from './SettingsSkeleton'
import { formatRelativeTime } from '@/utils/format'
import SettingsGroup from './SettingsGroup'

interface NotificationManagementProps {
  isAdmin?: boolean
}

interface NotificationForm {
  content: string
  target_user_id: number | null
  title: string
  type: string
}

const emptyNotification: NotificationForm = {
  content: '',
  target_user_id: 0,
  title: '',
  type: 'system',
}

const getNotificationTypeName = (type: number) => {
  if (type === 2) return '活动'
  if (type === 3) return '私信'
  return '系统'
}

const getFormType = (type: number) => {
  if (type === 2) return 'activity'
  if (type === 3) return 'private'
  return 'system'
}

export default function NotificationManagement({ isAdmin = false }: NotificationManagementProps) {
  const { confirm } = useConfirm()
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationTotal, setNotificationTotal] = useState(0)
  const [targetUsers, setTargetUsers] = useState<UserBrief[]>([])
  const [notificationLoading, setNotificationLoading] = useState(true)
  const [targetUsersLoading, setTargetUsersLoading] = useState(isAdmin)
  const [notificationCurrentPage, setNotificationCurrentPage] = useState(1)
  const [notificationPageSize, setNotificationPageSize] = useState(5)
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const [failedScope, setFailedScope] = useState<string | null>(null)
  const requestScope = JSON.stringify([notificationCurrentPage, notificationPageSize])
  const dataIsCurrent = loadedScope === requestScope
  const loadError = failedScope === requestScope
  const showingSkeleton = !dataIsCurrent && !loadError
  const busy = notificationLoading || showingSkeleton
  const [showCreateNotificationModal, setShowCreateNotificationModal] = useState(false)
  const [creatingNotification, setCreatingNotification] = useState(false)
  const [newNotification, setNewNotification] = useState<NotificationForm>(emptyNotification)
  const [showNotificationDetailModal, setShowNotificationDetailModal] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [isEditingNotification, setIsEditingNotification] = useState(false)
  const notificationsRequestRef = useRef(0)
  const targetUsersRequestRef = useRef(0)
  const mutationInFlightRef = useRef(false)
  const mountedRef = useRef(false)
  const loadNotificationsRef = useRef<(() => Promise<void>) | null>(null)
  const currentScopeRef = useRef(requestScope)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      notificationsRequestRef.current += 1
      targetUsersRequestRef.current += 1
    }
  }, [])

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  )
  const notificationTotalPages = Math.ceil(notificationTotal / notificationPageSize)
  const notificationPaginationInfo = useMemo(() => {
    if (notificationTotal === 0) return '暂无数据'
    const start = (notificationCurrentPage - 1) * notificationPageSize + 1
    const end = Math.min(notificationCurrentPage * notificationPageSize, notificationTotal)
    return `显示 ${start}-${end} 条，共 ${notificationTotal} 条`
  }, [notificationCurrentPage, notificationPageSize, notificationTotal])

  const loadNotifications = useCallback(async () => {
    if (!mountedRef.current) return
    const requestId = ++notificationsRequestRef.current
    setNotificationLoading(true)
    setFailedScope(null)
    try {
      const response = await notificationApi.list(notificationCurrentPage, notificationPageSize)
      if (requestId === notificationsRequestRef.current) {
        setNotifications(response.data.data.list)
        setNotificationTotal(response.data.data.total)
        setLoadedScope(requestScope)
      }
    } catch {
      if (requestId === notificationsRequestRef.current) {
        setFailedScope(requestScope)
        toastError('获取通知失败')
      }
    } finally {
      if (requestId === notificationsRequestRef.current) setNotificationLoading(false)
    }
  }, [notificationCurrentPage, notificationPageSize, requestScope, toastError])

  useLayoutEffect(() => {
    loadNotificationsRef.current = loadNotifications
    currentScopeRef.current = requestScope
  }, [loadNotifications, requestScope])

  const loadTargetUsers = useCallback(async () => {
    if (!mountedRef.current) return
    const requestId = ++targetUsersRequestRef.current
    setTargetUsersLoading(true)
    try {
      const response = await notificationApi.getUsers()
      if (requestId === targetUsersRequestRef.current) setTargetUsers(response.data.data)
    } catch {
      if (requestId === targetUsersRequestRef.current) toastError('获取用户列表失败')
    } finally {
      if (requestId === targetUsersRequestRef.current) setTargetUsersLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    const timer = window.setTimeout(loadNotifications, 0)
    return () => {
      window.clearTimeout(timer)
      notificationsRequestRef.current += 1
    }
  }, [loadNotifications])

  useEffect(() => {
    if (!isAdmin) return undefined
    const timer = window.setTimeout(loadTargetUsers, 0)
    return () => {
      window.clearTimeout(timer)
      targetUsersRequestRef.current += 1
    }
  }, [isAdmin, loadTargetUsers])

  const openCreateModal = () => {
    setIsEditingNotification(false)
    setSelectedNotification(null)
    setNewNotification(emptyNotification)
    setShowCreateNotificationModal(true)
  }

  const handleCreateNotification = async () => {
    if (!mountedRef.current || mutationInFlightRef.current) return
    if (!newNotification.title || !newNotification.content) {
      toastError('请填写标题和内容')
      return
    }
    if (
      newNotification.target_user_id === null ||
      !Number.isSafeInteger(newNotification.target_user_id) ||
      newNotification.target_user_id < 0
    ) {
      toastError('请选择发送对象')
      return
    }

    mutationInFlightRef.current = true
    setCreatingNotification(true)
    try {
      await notificationApi.create({
        ...newNotification,
        target_user_id: newNotification.target_user_id,
      })
      if (!mountedRef.current) return
      toastSuccess('发送成功')
      setShowCreateNotificationModal(false)
      setNewNotification(emptyNotification)
      await loadNotificationsRef.current?.()
    } catch {
      if (mountedRef.current) toastError('发送失败')
    } finally {
      mutationInFlightRef.current = false
      if (mountedRef.current) setCreatingNotification(false)
    }
  }

  const handleDeleteNotification = async (id: number) => {
    if (!mountedRef.current) return
    const confirmed = await confirm({
      actionLabel: '删除通知',
      actionVariant: 'danger',
      message: '确定要删除这条通知吗？',
      title: '确认删除',
    })
    if (!confirmed || !mountedRef.current) return

    try {
      await notificationApi.delete(id)
      if (!mountedRef.current) return
      toastSuccess('删除成功')
      await loadNotificationsRef.current?.()
    } catch {
      if (mountedRef.current) toastError('删除失败')
    }
  }

  const viewNotificationDetail = async (notification: Notification) => {
    setSelectedNotification(notification)
    setIsEditingNotification(false)
    setShowNotificationDetailModal(true)

    if (!notification.is_read) {
      try {
        await notificationApi.markAsRead(notification.id)
        if (!mountedRef.current || currentScopeRef.current !== requestScope) return
        notificationsRequestRef.current += 1
        setNotificationLoading(false)
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
        )
      } catch {
        if (mountedRef.current) toastError('标记已读失败')
      }
    }
  }

  const editNotification = (notification: Notification) => {
    setNewNotification({
      content: notification.content,
      target_user_id:
        notification.is_global === 1
          ? 0
          : notification.target_user_id && notification.target_user_id > 0
            ? notification.target_user_id
            : null,
      title: notification.title,
      type: getFormType(notification.type),
    })
    setSelectedNotification(notification)
    setIsEditingNotification(true)
    setShowCreateNotificationModal(true)
  }

  const handleUpdateNotification = async () => {
    if (!mountedRef.current || !selectedNotification || mutationInFlightRef.current) return
    if (!newNotification.title || !newNotification.content) {
      toastError('请填写标题和内容')
      return
    }
    if (
      newNotification.target_user_id === null ||
      !Number.isSafeInteger(newNotification.target_user_id) ||
      newNotification.target_user_id < 0
    ) {
      toastError('请选择发送对象')
      return
    }

    mutationInFlightRef.current = true
    setCreatingNotification(true)
    try {
      await notificationApi.update(selectedNotification.id, {
        ...newNotification,
        target_user_id: newNotification.target_user_id,
      })
      if (!mountedRef.current) return
      toastSuccess('更新成功')
      setShowCreateNotificationModal(false)
      await loadNotificationsRef.current?.()
    } catch {
      if (mountedRef.current) toastError('更新失败')
    } finally {
      mutationInFlightRef.current = false
      if (mountedRef.current) setCreatingNotification(false)
    }
  }

  return (
    <div className="notification-management settings-page">
      <div className="settings-toolbar">
        <h2 className="settings-toolbar__title">
          {showingSkeleton ? (
            <Skeleton height="1.25rem" width="5rem" />
          ) : !dataIsCurrent ? (
            '通知'
          ) : unreadNotifications > 0 ? (
            `${unreadNotifications} 条未读`
          ) : (
            '全部已读'
          )}
        </h2>
        {isAdmin ? (
          <Button onClick={openCreateModal}>
            <JadeIcon name="add" size="1em" />
            <span>发送通知</span>
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <Alert
          action={
            <Button
              aria-label="重试通知列表"
              onClick={() => void loadNotifications()}
              size="sm"
              variant="secondary"
            >
              重试
            </Button>
          }
          title="通知列表加载失败"
          tone="danger"
        >
          {dataIsCurrent ? '当前展示最近一次成功加载的数据。' : '暂时无法获取通知数据，请重试。'}
        </Alert>
      ) : null}

      {showingSkeleton ? (
        <SettingsListSkeleton label="正在加载通知列表" />
      ) : dataIsCurrent && notifications.length === 0 ? (
        <EmptyState
          className="settings-empty"
          scene={<EmptyScene name="notifications-empty" size="standard" />}
          size="lg"
          title="暂无通知"
        />
      ) : dataIsCurrent ? (
        <SettingsGroup flush>
          <ul aria-busy={busy} className="settings-list">
            {notifications.map((notification) => (
              <li
                className="settings-row notification-row"
                data-unread={!notification.is_read || undefined}
                key={notification.id}
              >
                <span aria-hidden="true" className="notification-row__dot" />
                <div className="notification-row__copy">
                  <span className="notification-row__title">
                    {!notification.is_read ? <span className="ods-sr-only">未读：</span> : null}
                    {notification.title}
                  </span>
                  <span className="notification-row__summary">{notification.content}</span>
                </div>
                <span className="notification-row__tag">
                  <Chip
                    tone={
                      notification.type === 2
                        ? 'accent'
                        : notification.type === 3
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {getNotificationTypeName(notification.type)}
                    {notification.is_global === 1 ? ' · 全员' : ''}
                  </Chip>
                </span>
                <span className="notification-row__meta">
                  {notification.sender ? `${notification.sender.name} · ` : ''}
                  {formatRelativeTime(notification.create_time)}
                </span>
                <div className="settings-table__actions">
                  <IconButton
                    label={`查看通知：${notification.title}`}
                    onClick={() => void viewNotificationDetail(notification)}
                    size="sm"
                    title="查看"
                    variant="tertiary"
                  >
                    <JadeIcon name="eye" size="1em" />
                  </IconButton>
                  {isAdmin ? (
                    <>
                      <IconButton
                        label="编辑通知"
                        onClick={() => editNotification(notification)}
                        size="sm"
                        title="编辑"
                        variant="secondary"
                      >
                        <JadeIcon motionPreset="interactive" name="edit" size="1em" />
                      </IconButton>
                      <IconButton
                        label="删除通知"
                        onClick={() => void handleDeleteNotification(notification.id)}
                        size="sm"
                        title="删除"
                        tone="danger"
                        variant="tertiary"
                      >
                        <JadeIcon name="trash" size="1em" />
                      </IconButton>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </SettingsGroup>
      ) : null}

      {dataIsCurrent &&
      (notificationTotal > notificationPageSize || notificationCurrentPage > 1) ? (
        <PaginationBar
          info={notificationPaginationInfo}
          onPageChange={setNotificationCurrentPage}
          page={notificationCurrentPage}
          pageCount={notificationTotalPages}
          trailing={
            <Select
              aria-label="每页通知数"
              clearable={false}
              onValueChange={(value) => {
                setNotificationPageSize(Number(value))
                setNotificationCurrentPage(1)
              }}
              options={[
                { label: '5条/页', value: '5' },
                { label: '10条/页', value: '10' },
              ]}
              size="sm"
              value={String(notificationPageSize)}
              width="content"
            />
          }
        />
      ) : null}

      <Modal.Root
        onClose={() => setShowCreateNotificationModal(false)}
        open={showCreateNotificationModal}
      >
        <Modal.Header>{isEditingNotification ? '编辑通知' : '发送通知'}</Modal.Header>
        <Modal.Close label={isEditingNotification ? '关闭编辑通知弹窗' : '关闭发送通知弹窗'} />
        <Modal.Body className="settings-modal-body">
          <Field.Root required>
            <Field.Label>通知标题</Field.Label>
            <Input
              onChange={(event) =>
                setNewNotification((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="请输入通知标题"
              value={newNotification.title}
            />
          </Field.Root>
          <Field.Root required>
            <Field.Label>通知内容</Field.Label>
            <TextArea
              onChange={(event) =>
                setNewNotification((current) => ({ ...current, content: event.target.value }))
              }
              placeholder="请输入通知内容"
              rows={4}
              value={newNotification.content}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>通知类型</Field.Label>
            <Select
              aria-label="通知类型"
              clearable={false}
              onValueChange={(value) =>
                setNewNotification((current) => ({ ...current, type: value }))
              }
              options={[
                { label: '系统通知', value: 'system' },
                { label: '活动通知', value: 'activity' },
                ...(isEditingNotification && selectedNotification?.type === 3
                  ? [{ label: '私信', value: 'private' }]
                  : []),
              ]}
              value={newNotification.type}
            />
          </Field.Root>
          {isAdmin ? (
            <Field.Root>
              <Field.Label>发送对象</Field.Label>
              {targetUsersLoading && targetUsers.length === 0 ? (
                <div aria-label="正在加载发送对象" role="status">
                  <Skeleton height="var(--ods-control-height-md)" />
                </div>
              ) : (
                <Select
                  aria-label="发送对象"
                  clearable={false}
                  onValueChange={(value) => {
                    const target = Number(value)
                    setNewNotification((current) => ({
                      ...current,
                      target_user_id:
                        value !== '' && Number.isSafeInteger(target) && target >= 0 ? target : null,
                    }))
                  }}
                  options={[
                    { label: '全员通知', value: '0' },
                    ...targetUsers.map((targetUser) => ({
                      label: `${targetUser.name} (${targetUser.username})`,
                      value: String(targetUser.id),
                    })),
                    ...(newNotification.target_user_id &&
                    !targetUsers.some((user) => user.id === newNotification.target_user_id)
                      ? [
                          {
                            label: `用户 #${newNotification.target_user_id}`,
                            value: String(newNotification.target_user_id),
                          },
                        ]
                      : []),
                  ]}
                  value={
                    newNotification.target_user_id === null
                      ? ''
                      : String(newNotification.target_user_id)
                  }
                />
              )}
            </Field.Root>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <FormActions>
            <Button onClick={() => setShowCreateNotificationModal(false)} variant="secondary">
              取消
            </Button>
            <Button
              onClick={() =>
                void (isEditingNotification
                  ? handleUpdateNotification()
                  : handleCreateNotification())
              }
              pending={creatingNotification}
            >
              {creatingNotification ? '提交中...' : isEditingNotification ? '更新' : '发送'}
            </Button>
          </FormActions>
        </Modal.Footer>
      </Modal.Root>

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setShowNotificationDetailModal(false)}
        open={showNotificationDetailModal}
      />
    </div>
  )
}
