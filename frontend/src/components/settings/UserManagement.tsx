import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authApi, type User } from '@/api/auth'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
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
  FormGrid,
  IconButton,
  Input,
  JadeIcon,
  Modal,
  PaginationBar,
  SearchField,
  Select,
  Table,
  User as UserBadge,
} from '@/design-system'
import { SettingsTableSkeleton } from './SettingsSkeleton'

interface UserForm {
  department: string
  email: string
  name: string
  password: string
  phone: string
  position: string
  role: 'admin' | 'user'
  status: number
  username: string
}

const emptyForm: UserForm = {
  department: '',
  email: '',
  name: '',
  password: '',
  phone: '',
  position: '',
  role: 'user',
  status: 1,
  username: '',
}

export default function UserManagement() {
  const { confirm } = useConfirm()
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const [failedScope, setFailedScope] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const requestScope = JSON.stringify([currentPage, pageSize, searchKeyword])
  const dataIsCurrent = loadedScope === requestScope
  const loadError = failedScope === requestScope
  const showingSkeleton = !dataIsCurrent && !loadError
  const busy = loading || showingSkeleton
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const loadRequestRef = useRef(0)
  const submitInFlightRef = useRef(false)
  const resetInFlightRef = useRef(false)

  const totalPages = Math.ceil(total / pageSize)
  const paginationInfo = useMemo(() => {
    if (total === 0) return '暂无数据'
    const start = (currentPage - 1) * pageSize + 1
    const end = Math.min(currentPage * pageSize, total)
    return `显示 ${start}-${end} 条，共 ${total} 条`
  }, [currentPage, pageSize, total])

  const loadUsers = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    setFailedScope(null)
    try {
      const response = await authApi.getUsers({
        keyword: searchKeyword || undefined,
        page: currentPage,
        page_size: pageSize,
      })
      if (requestId === loadRequestRef.current) {
        setUsers(response.data.data.list)
        setTotal(response.data.data.total)
        setLoadedScope(requestScope)
      }
    } catch {
      if (requestId === loadRequestRef.current) {
        setFailedScope(requestScope)
        toastError('获取用户失败')
      }
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }, [currentPage, pageSize, requestScope, searchKeyword, toastError])

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 0)
    return () => {
      window.clearTimeout(timer)
      loadRequestRef.current += 1
    }
  }, [loadUsers])

  const openAddModal = () => {
    setEditingUser(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setForm({
      department: user.department || '',
      email: user.email || '',
      name: user.name || '',
      password: '',
      phone: user.phone || '',
      position: user.position || '',
      role: user.role === 'admin' ? 'admin' : 'user',
      status: user.status,
      username: user.username,
    })
    setShowModal(true)
  }

  const handleSearch = () => {
    setCurrentPage(1)
    setSearchKeyword(keyword)
  }

  const handleClearSearch = () => {
    setCurrentPage(1)
    setSearchKeyword('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true
    setSubmitting(true)
    try {
      if (editingUser) {
        await authApi.updateUser(editingUser.id, {
          department: form.department,
          email: form.email,
          name: form.name,
          phone: form.phone,
          position: form.position,
          role: form.role,
          status: form.status,
        })
        toastSuccess('用户已更新')
      } else {
        await authApi.createUser({
          email: form.email,
          name: form.name,
          password: form.password,
          phone: form.phone,
          role: form.role,
          username: form.username,
        })
        toastSuccess('用户已创建')
      }

      setShowModal(false)
      await loadUsers()
    } catch {
      toastError(editingUser ? '更新用户失败' : '创建用户失败')
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }

  const handleDelete = async (user: User) => {
    const confirmed = await confirm({
      actionLabel: '删除用户',
      actionVariant: 'danger',
      message: `确定要删除用户「${user.name || user.username}」吗？此操作不可恢复。`,
      title: '删除用户？',
    })
    if (!confirmed) return

    try {
      await authApi.deleteUser(user.id)
      toastSuccess('用户已删除')
      await loadUsers()
    } catch {
      toastError('删除用户失败')
    }
  }

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!resetPasswordUser || resetInFlightRef.current) return
    resetInFlightRef.current = true
    setResettingPassword(true)

    try {
      await authApi.resetPassword(resetPasswordUser.id, newPassword)
      toastSuccess('密码已重置')
      setResetPasswordUser(null)
      setNewPassword('')
    } catch {
      toastError('重置密码失败')
    } finally {
      resetInFlightRef.current = false
      setResettingPassword(false)
    }
  }

  return (
    <div className="user-management settings-page">
      <div className="settings-toolbar">
        <SearchField
          aria-label="搜索用户"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="settings-toolbar__search"
          onClear={handleClearSearch}
          onKeyUp={(event) => {
            if (event.key === 'Enter') handleSearch()
          }}
          onValueChange={setKeyword}
          placeholder="搜索用户名或姓名"
          spellCheck={false}
          value={keyword}
        />
        <Button onClick={openAddModal}>
          <JadeIcon name="add" size="1em" />
          <span>新增用户</span>
        </Button>
      </div>

      {loadError ? (
        <Alert
          action={
            <Button
              aria-label="重试用户列表"
              onClick={() => void loadUsers()}
              size="sm"
              variant="secondary"
            >
              重试
            </Button>
          }
          title="用户列表加载失败"
          tone="danger"
        >
          {dataIsCurrent ? '当前展示最近一次成功加载的数据。' : '暂时无法获取用户数据，请重试。'}
        </Alert>
      ) : null}

      {showingSkeleton ? (
        <SettingsTableSkeleton columns={6} label="正在加载用户列表" />
      ) : dataIsCurrent && users.length === 0 ? (
        <EmptyState
          className="settings-empty"
          scene={
            <EmptyScene
              name={searchKeyword ? 'search-empty' : 'users-empty'}
              size="standard"
            />
          }
          size="lg"
          title={searchKeyword ? '没有符合条件的用户' : '暂无用户'}
        />
      ) : dataIsCurrent ? (
        <Table.Root aria-busy={busy} aria-label="用户列表" className="settings-table">
          <Table.Header>
            <Table.Row>
              <Table.Column>用户</Table.Column>
              <Table.Column>角色</Table.Column>
              <Table.Column>部门与职位</Table.Column>
              <Table.Column>联系方式</Table.Column>
              <Table.Column>状态</Table.Column>
              <Table.Column align="end">
                <span className="ods-sr-only">操作</span>
              </Table.Column>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {users.map((user) => (
              <Table.Row key={user.id}>
                <Table.Cell>
                  <UserBadge
                    avatarProps={{
                      name: user.name || user.username,
                      size: 'sm',
                      tone: user.role === 'admin' ? 'accent' : 'neutral',
                    }}
                    description={user.username}
                    name={user.name || user.username}
                  />
                </Table.Cell>
                <Table.Cell>{user.role === 'admin' ? '管理员' : '普通用户'}</Table.Cell>
                <Table.Cell>
                  <span className="settings-table__muted">
                    {[user.department, user.position].filter(Boolean).join(' · ') || '—'}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="settings-table__stack settings-table__muted">
                    {user.email ? <span>{user.email}</span> : null}
                    {user.phone ? <span>{user.phone}</span> : null}
                    {!user.email && !user.phone ? <span>—</span> : null}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Chip size="sm" tone={user.status === 1 ? 'success' : 'danger'}>
                    {user.status === 1 ? '正常' : '禁用'}
                  </Chip>
                </Table.Cell>
                <Table.Cell align="end">
                  <div className="settings-table__actions">
                    <IconButton
                      label="编辑用户"
                      onClick={() => openEditModal(user)}
                      size="sm"
                      title="编辑"
                      variant="tertiary"
                    >
                      <JadeIcon motionPreset="interactive" name="edit" size="1em" />
                    </IconButton>
                    <IconButton
                      label="重置用户密码"
                      onClick={() => {
                        setResetPasswordUser(user)
                        setNewPassword('')
                      }}
                      size="sm"
                      title="重置密码"
                      variant="secondary"
                    >
                      <JadeIcon name="lock-password" size="1em" />
                    </IconButton>
                    <IconButton
                      label="删除用户"
                      onClick={() => void handleDelete(user)}
                      size="sm"
                      title="删除"
                      tone="danger"
                      variant="tertiary"
                    >
                      <JadeIcon name="trash" size="1em" />
                    </IconButton>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      ) : null}

      {dataIsCurrent && (total > pageSize || currentPage > 1) ? (
        <PaginationBar
          info={paginationInfo}
          onPageChange={setCurrentPage}
          page={currentPage}
          pageCount={totalPages}
          trailing={
            <Select
              aria-label="每页条数"
              clearable={false}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setCurrentPage(1)
              }}
              options={[
                { label: '5条/页', value: '5' },
                { label: '10条/页', value: '10' },
              ]}
              size="sm"
              value={String(pageSize)}
              width="content"
            />
          }
        />
      ) : null}

      <Modal.Root
        dismissable={!submitting}
        onClose={() => setShowModal(false)}
        open={showModal}
        size="lg"
      >
        <Modal.Header>{editingUser ? '编辑用户' : '新增用户'}</Modal.Header>
        {!submitting ? (
          <Modal.Close label={editingUser ? '关闭编辑用户弹窗' : '关闭新增用户弹窗'} />
        ) : null}
        <form onSubmit={handleSubmit}>
          <Modal.Body className="settings-modal-body">
            <FormGrid columns={2}>
              <Field.Root required>
                <Field.Label>用户名</Field.Label>
                <Input
                  disabled={Boolean(editingUser)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, username: event.target.value }))
                  }
                  value={form.username}
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label>姓名</Field.Label>
                <Input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  value={form.name}
                />
              </Field.Root>
              {!editingUser ? (
                <Field.Root className="settings-field--full" required>
                  <Field.Label>初始密码</Field.Label>
                  <Input
                    autoComplete="new-password"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    type="password"
                    value={form.password}
                  />
                </Field.Root>
              ) : null}
              <Field.Root>
                <Field.Label>角色</Field.Label>
                <Select
                  aria-label="角色"
                  clearable={false}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, role: value as 'admin' | 'user' }))
                  }
                  options={[
                    { label: '普通用户', value: 'user' },
                    { label: '管理员', value: 'admin' },
                  ]}
                  value={form.role}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>状态</Field.Label>
                <Select
                  aria-label="状态"
                  clearable={false}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, status: Number(value) }))
                  }
                  options={[
                    { label: '正常', value: '1' },
                    { label: '禁用', value: '0' },
                  ]}
                  value={String(form.status)}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>邮箱</Field.Label>
                <Input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  type="email"
                  value={form.email}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>手机</Field.Label>
                <Input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  value={form.phone}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>部门</Field.Label>
                <Input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, department: event.target.value }))
                  }
                  value={form.department}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>职位</Field.Label>
                <Input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, position: event.target.value }))
                  }
                  value={form.position}
                />
              </Field.Root>
            </FormGrid>
          </Modal.Body>
          <Modal.Footer>
            <FormActions>
              <Button disabled={submitting} onClick={() => setShowModal(false)} variant="ghost">
                取消
              </Button>
              <Button pending={submitting} type="submit">
                {submitting ? '保存中...' : '保存'}
              </Button>
            </FormActions>
          </Modal.Footer>
        </form>
      </Modal.Root>

      <Modal.Root
        dismissable={!resettingPassword}
        onClose={() => setResetPasswordUser(null)}
        open={Boolean(resetPasswordUser)}
        size="sm"
      >
        <Modal.Header>重置密码 - {resetPasswordUser?.username}</Modal.Header>
        {!resettingPassword ? <Modal.Close label="关闭重置密码弹窗" /> : null}
        <form onSubmit={handleResetPassword}>
          <Modal.Body className="settings-modal-body">
            <Field.Root required>
              <Field.Label>新密码</Field.Label>
              <Input
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </Field.Root>
          </Modal.Body>
          <Modal.Footer>
            <FormActions>
              <Button
                disabled={resettingPassword}
                onClick={() => setResetPasswordUser(null)}
                variant="ghost"
              >
                取消
              </Button>
              <Button pending={resettingPassword} type="submit">
                {resettingPassword ? '重置中...' : '确认重置'}
              </Button>
            </FormActions>
          </Modal.Footer>
        </form>
      </Modal.Root>
    </div>
  )
}
