import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Browser } from '@wailsio/runtime'
import type { User } from '@/api/auth'
import { DEFAULT_APP_SLOGAN, DEFAULT_WECHAT_PUBLIC_ACCOUNT, systemApi } from '@/api/system'
import DataSyncPanel from '@/components/settings/DataSyncPanel'
import DictionaryManagement from '@/components/settings/DictionaryManagement'
import NotificationManagement from '@/components/settings/NotificationManagement'
import SettingsGroup from '@/components/settings/SettingsGroup'
import { SettingsFormSkeleton } from '@/components/settings/SettingsSkeleton'
import TokenManagement from '@/components/settings/TokenManagement'
import UserManagement from '@/components/settings/UserManagement'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/composables/useToast'
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  Field,
  FormGrid,
  Image,
  Input,
  JadeIcon,
  PageHeader,
  ProgressBar,
  Radio,
  RadioGroup,
  RouterButton,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  type JadeIconName,
} from '@/design-system'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAppearanceStore, type AppearancePreferences } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'
import { THEME_OPTIONS, useThemeStore, type ThemeMode } from '@/stores/theme'
import { appUpdater, type UpdateStatus } from '@/utils/appUpdater'
import '@/styles/settings.css'
import pkg from '../../package.json'

const techStack = ['Wails v3', 'React', 'TypeScript', 'Go']

const appearanceSwitches: ReadonlyArray<{ key: keyof AppearancePreferences; title: string }> = [
  { key: 'sceneMotion', title: '江南动态场景' },
  { key: 'reduceMotion', title: '减少动态效果' },
  { key: 'liquidGlass', title: '液态玻璃效果' },
]

interface ProfileFields {
  department: string
  email: string
  name: string
  phone: string
  position: string
}

interface ProfileFormState {
  baseline: ProfileFields
  draft: ProfileFields
  identity: string | null
}

const profileFromUser = (user: User | null): ProfileFields => ({
  department: user?.department || '',
  email: user?.email || '',
  name: user?.name || '',
  phone: user?.phone || '',
  position: user?.position || '',
})

const userIdentity = (user: User | null) => (user ? `${user.id}:${user.username}` : null)

const profilesMatch = (first: ProfileFields, second: ProfileFields) =>
  first.department === second.department &&
  first.email === second.email &&
  first.name === second.name &&
  first.phone === second.phone &&
  first.position === second.position

const createProfileFormState = (user: User | null): ProfileFormState => {
  const profile = profileFromUser(user)
  return {
    baseline: profile,
    draft: profile,
    identity: userIdentity(user),
  }
}

/**
 * A miniature of the window in one theme. Each layer carries `data-theme`, so the theme's own
 * tokens paint it whatever theme the app is in; 跟随系统 shows half of each.
 */
function ThemeThumbnail({ mode }: { mode: ThemeMode }) {
  const themes = mode === 'auto' ? (['light', 'dark'] as const) : [mode]

  return (
    <span aria-hidden="true" className="settings-theme">
      {themes.map((theme, index) => (
        <span
          className="settings-theme__layer"
          data-half={index === 1 || undefined}
          data-theme={theme}
          key={theme}
        >
          <span className="settings-theme__panel" />
          <span className="settings-theme__dock" />
        </span>
      ))}
    </span>
  )
}

export default function SettingsView() {
  const navigate = useNavigate()
  const rowId = useId()
  const [searchParams, setSearchParams] = useSearchParams()
  const { confirm } = useConfirm()
  const toastError = useToastStore((state) => state.error)
  const toastInfo = useToastStore((state) => state.info)
  const toastSuccess = useToastStore((state) => state.success)
  const toastWarning = useToastStore((state) => state.warning)
  const user = useAuthStore((state) => state.user)
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const changePassword = useAuthStore((state) => state.changePassword)
  const logout = useAuthStore((state) => state.logout)
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  const appearance = useAppearanceStore()
  const isAdmin = user?.role === 'admin'
  const stacked = useMediaQuery('(max-width: 56rem)')
  const [profileForm, setProfileForm] = useState(() => createProfileFormState(user))
  const profile = profileForm.draft
  const originalProfile = profileForm.baseline
  const [securityForm, setSecurityForm] = useState({
    confirmPassword: '',
    newPassword: '',
    oldPassword: '',
  })
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [appVersion, setAppVersion] = useState(pkg.version)
  const [appSlogan, setAppSlogan] = useState(DEFAULT_APP_SLOGAN)
  const [brandingLoaded, setBrandingLoaded] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(Boolean(user))
  const [updaterStatusLoaded, setUpdaterStatusLoaded] = useState(() => !appUpdater.isAvailable())
  const [wechatPublicAccount, setWechatPublicAccount] = useState(DEFAULT_WECHAT_PUBLIC_ACCOUNT)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [updating, setUpdating] = useState(false)
  const [cancellingUpdate, setCancellingUpdate] = useState(false)
  const mountedRef = useRef(false)
  const updateRequestRef = useRef(false)
  const updateGenerationRef = useRef(0)
  const profileLoadGenerationRef = useRef(0)

  const loadProfile = useCallback(async () => {
    const generation = ++profileLoadGenerationRef.current
    setProfileLoaded(false)
    try {
      await refreshUser()
    } catch {
      // A missing user after this attempt is presented as a retryable loading failure.
    } finally {
      if (mountedRef.current && generation === profileLoadGenerationRef.current) {
        setProfileLoaded(true)
      }
    }
  }, [refreshUser])

  useEffect(() => {
    if (searchParams.get('tab') !== 'about') return
    let active = true
    void systemApi
      .info()
      .then(({ data }) => {
        if (!active) return
        setAppSlogan(data.data.slogan?.trim() || DEFAULT_APP_SLOGAN)
        setWechatPublicAccount(
          data.data.wechat_public_account?.trim() || DEFAULT_WECHAT_PUBLIC_ACCOUNT,
        )
      })
      .catch(() => {
        // The default stays useful when older backends do not expose branding yet.
      })
      .finally(() => {
        if (active) setBrandingLoaded(true)
      })
    return () => {
      active = false
    }
  }, [searchParams])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!appUpdater.isAvailable()) return
    let active = true
    const generation = updateGenerationRef.current
    void appUpdater
      .status()
      .then((status) => {
        if (!active || generation !== updateGenerationRef.current) return
        if (status.state === 'error') setUpdateStatus(status)
        if (['downloading', 'installing', 'restarting'].includes(status.state)) {
          setUpdateStatus(status)
          setUpdating(true)
        }
      })
      .catch(() => {
        // The normal check action reports service failures; restoring old progress is optional.
      })
      .finally(() => {
        if (active && generation === updateGenerationRef.current) setUpdaterStatusLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!updating) return
    let active = true
    let timer: number | undefined

    const pollStatus = async () => {
      try {
        const status = await appUpdater.status()
        if (!active) return
        setUpdateStatus(status)
        if (status.state === 'error') {
          setUpdating(false)
          setCancellingUpdate(false)
          toastError(status.message || '更新失败，请重试')
          return
        }
        if (status.state === 'idle' || status.state === 'available') {
          setUpdating(false)
          setCancellingUpdate(false)
          if (status.message) toastInfo(status.message)
          return
        }
        // Once the helper takes over, the old process is closing and cannot answer more calls.
        if (status.state === 'restarting') return
        timer = window.setTimeout(() => void pollStatus(), 500)
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : '无法获取更新进度，请重试'
        setUpdating(false)
        setCancellingUpdate(false)
        setUpdateStatus((current) => ({
          state: 'error',
          progress: current?.progress ?? 0,
          downloadedBytes: current?.downloadedBytes ?? 0,
          totalBytes: current?.totalBytes ?? 0,
          message,
        }))
        toastError(message)
      }
    }

    void pollStatus()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [toastError, toastInfo, updating])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      profileLoadGenerationRef.current += 1
    }
  }, [loadProfile])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextProfile = profileFromUser(user)
      const nextIdentity = userIdentity(user)

      setProfileForm((current) => {
        const identityChanged = current.identity !== nextIdentity
        const isDirty = !profilesMatch(current.draft, current.baseline)

        if (!identityChanged && isDirty) return current

        return {
          baseline: nextProfile,
          draft: nextProfile,
          identity: nextIdentity,
        }
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [user])

  const settingsNav = useMemo(
    (): ReadonlyArray<{ icon: JadeIconName; key: string; label: string }> => [
      { icon: 'user', key: 'profile', label: '个人信息' },
      { icon: 'palette', key: 'appearance', label: '外观设置' },
      { icon: 'bell', key: 'notification', label: '通知设置' },
      { icon: 'cloud', key: 'data-sync', label: '数据同步' },
      ...(isAdmin
        ? [
            { icon: 'users' as const, key: 'users', label: '用户管理' },
            { icon: 'book' as const, key: 'dictionary', label: '字典管理' },
          ]
        : []),
      { icon: 'code', key: 'developer', label: '开发设置' },
      { icon: 'info', key: 'about', label: '关于' },
    ],
    [isAdmin],
  )

  // 安全设置 moved onto the profile page; old links to it still land in the right place.
  const requestedTab = searchParams.get('tab') === 'security' ? 'profile' : searchParams.get('tab')
  const activeTab =
    requestedTab && settingsNav.some((item) => item.key === requestedTab) ? requestedTab : 'profile'
  const profileDirty = !profilesMatch(profile, originalProfile)

  const selectTab = (tab: string) => {
    if (tab === activeTab || !settingsNav.some((item) => item.key === tab)) return

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', tab)
    setSearchParams(nextSearchParams)
  }

  const updateProfileField = (field: keyof ProfileFields, value: string) => {
    setProfileForm((current) => ({
      ...current,
      draft: { ...current.draft, [field]: value },
    }))
  }

  const saveProfile = async () => {
    const isModified = !profilesMatch(profile, originalProfile)

    if (!isModified) {
      toastInfo('未做任何修改')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (profile.email && !emailRegex.test(profile.email)) {
      toastWarning('邮箱格式不正确')
      return
    }

    const phoneRegex = /^1[3-9]\d{9}$/
    if (profile.phone && !phoneRegex.test(profile.phone)) {
      toastWarning('手机号格式不正确')
      return
    }

    const submittedProfile = profile
    const submittedIdentity = profileForm.identity
    const ok = await updateProfile(submittedProfile)
    if (ok) {
      toastSuccess('保存成功')
      setProfileForm((current) => {
        if (current.identity !== submittedIdentity) return current

        return {
          ...current,
          baseline: submittedProfile,
          draft: profilesMatch(current.draft, submittedProfile) ? submittedProfile : current.draft,
        }
      })
    }
  }

  const handlePasswordChange = async () => {
    if (!securityForm.oldPassword || !securityForm.newPassword || !securityForm.confirmPassword) {
      toastWarning('请填写所有密码字段')
      return
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      toastWarning('两次输入的新密码不一致')
      return
    }
    if (securityForm.newPassword.length < 6) {
      toastWarning('新密码长度不能少于6位')
      return
    }

    const ok = await changePassword(securityForm.oldPassword, securityForm.newPassword)
    if (ok) {
      toastSuccess('密码修改成功')
      setSecurityForm({ confirmPassword: '', newPassword: '', oldPassword: '' })
    } else {
      toastError(useAuthStore.getState().error || '密码修改失败')
    }
  }

  const handleLogout = async () => {
    await logout()
    await navigate('/login')
  }

  const openExternalUrl = (url: string) => {
    void Browser.OpenURL(url).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer')
    })
  }

  const openGitHub = () => {
    openExternalUrl('https://github.com/primordialweave/zhusuan')
  }

  const checkUpdate = async () => {
    if (updateRequestRef.current || updating) return
    updateRequestRef.current = true
    updateGenerationRef.current += 1
    setCheckingUpdate(true)
    setUpdateStatus(null)
    try {
      const info = await appUpdater.checkForUpdates(pkg.version)
      if (!mountedRef.current) return
      setAppVersion(info.currentVersion.replace(/^v/, ''))
      if (!info.available) {
        toastSuccess(`当前已是最新版本 (v${info.currentVersion.replace(/^v/, '')})`)
        return
      }

      const confirmed = await confirm({
        actionLabel: info.supported ? '更新并重启' : '前往下载',
        message: info.supported
          ? `新版本 v${info.latestVersion.replace(/^v/, '')} 已发布，更新完成后将自动重启应用。`
          : `新版本 v${info.latestVersion.replace(/^v/, '')} 已发布。${info.reason}`,
        title: '发现新版本',
      })

      if (!confirmed || !mountedRef.current) return
      if (!info.supported) {
        openExternalUrl(info.releaseURL)
        return
      }

      await appUpdater.startUpdate()
      if (!mountedRef.current) return
      setUpdateStatus({
        state: 'downloading',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        message: '正在下载更新',
      })
      setUpdating(true)
    } catch (error) {
      if (!mountedRef.current) return
      const message = error instanceof Error ? error.message : '检查更新失败，请稍后重试'
      setUpdateStatus({
        state: 'error',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        message,
      })
      toastError(message)
    } finally {
      updateRequestRef.current = false
      if (mountedRef.current) setCheckingUpdate(false)
    }
  }

  const cancelUpdate = async () => {
    if (cancellingUpdate || !updating || updateStatus?.state !== 'downloading') return
    setCancellingUpdate(true)
    try {
      await appUpdater.cancelUpdate()
    } catch (error) {
      if (!mountedRef.current) return
      toastError(error instanceof Error ? error.message : '无法取消更新，请稍后重试')
      setCancellingUpdate(false)
    }
  }

  const passwordField = (field: keyof typeof securityForm, label: string, placeholder: string) => (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Input
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        onChange={(event) =>
          setSecurityForm((current) => ({ ...current, [field]: event.target.value }))
        }
        placeholder={placeholder}
        spellCheck={false}
        type="password"
        value={securityForm[field]}
      />
    </Field.Root>
  )

  const profileField = (
    field: keyof ProfileFields,
    label: string,
    type: 'email' | 'tel' | 'text',
  ) => (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Input
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        onChange={(event) => updateProfileField(field, event.target.value)}
        spellCheck={false}
        type={type}
        value={profile[field]}
      />
    </Field.Root>
  )

  const activePanel = () => {
    if (activeTab === 'users' && isAdmin) {
      return (
        <section className="settings-management-panel" aria-label="用户管理设置">
          <UserManagement />
        </section>
      )
    }

    if (activeTab === 'dictionary') {
      return (
        <section className="settings-management-panel" aria-label="字典管理设置">
          <DictionaryManagement />
        </section>
      )
    }

    if (activeTab === 'data-sync') {
      return (
        <section className="settings-management-panel" aria-label="数据同步设置">
          <DataSyncPanel />
        </section>
      )
    }

    if (activeTab === 'developer') {
      return (
        <section className="settings-management-panel" aria-label="开发设置">
          <TokenManagement
            actions={
              <RouterButton to="/design-system" variant="outline">
                <span>组件展厅</span>
                <JadeIcon name="arrow-right" size="1em" />
              </RouterButton>
            }
          />
        </section>
      )
    }

    if (activeTab === 'notification') {
      return (
        <section className="settings-management-panel" aria-label="通知设置">
          <NotificationManagement isAdmin={isAdmin} />
        </section>
      )
    }

    if (activeTab === 'appearance') {
      return (
        <div className="settings-page">
          <SettingsGroup title="界面主题">
            <RadioGroup
              aria-label="界面主题"
              className="settings-themes"
              columns={3}
              onValueChange={(value) => setTheme(value as ThemeMode)}
              value={theme}
            >
              {THEME_OPTIONS.map((option) => (
                <Radio key={option.value} value={option.value} variant="card">
                  <ThemeThumbnail mode={option.value} />
                  <span className="settings-theme__name">{option.label}</span>
                </Radio>
              ))}
            </RadioGroup>
          </SettingsGroup>

          <SettingsGroup flush title="动态与材质">
            <ul className="settings-list">
              {appearanceSwitches.map((item) => (
                <li className="settings-row" key={item.key}>
                  <span className="settings-row__title" id={`${rowId}-${item.key}-title`}>
                    {item.title}
                  </span>
                  <Switch
                    aria-labelledby={`${rowId}-${item.key}-title`}
                    checked={appearance[item.key]}
                    onChange={(event) => appearance.setPreference(item.key, event.target.checked)}
                  />
                </li>
              ))}
            </ul>
          </SettingsGroup>
        </div>
      )
    }

    if (activeTab === 'about') {
      return (
        <div className="settings-page">
          <SettingsGroup>
            <div className="about-hero">
              <div className="about-brandmark">
                <Image
                  alt=""
                  background="transparent"
                  className="about-logo"
                  disableAnimation
                  fit="contain"
                  radius="none"
                  showSkeleton
                  src="/zhusuan-wordmark.png"
                />
              </div>
              <div className="about-hero__copy">
                <div className="about-hero__name">
                  <h2 className="about-title">珠算</h2>
                  <Chip size="sm" tone="accent">
                    v{appVersion}
                  </Chip>
                </div>
                <span
                  aria-busy={!brandingLoaded}
                  aria-label={!brandingLoaded ? '正在加载应用介绍' : undefined}
                  className="about-tagline"
                  role={!brandingLoaded ? 'status' : undefined}
                >
                  {brandingLoaded ? appSlogan : <Skeleton height="1rem" width="12rem" />}
                </span>
              </div>
              {!updaterStatusLoaded ? (
                <div aria-label="正在恢复更新状态" role="status">
                  <Skeleton height="var(--ods-control-height-md)" width="8rem" />
                </div>
              ) : (
                <Button
                  disabled={updating}
                  onClick={() => void checkUpdate()}
                  pending={checkingUpdate}
                  variant="outline"
                >
                  {checkingUpdate ? (
                    <Spinner aria-hidden="true" size="sm" />
                  ) : (
                    <JadeIcon name="refresh" size="1em" />
                  )}
                  <span>
                    {checkingUpdate
                      ? '正在检测更新...'
                      : updating
                        ? updateStatus?.state === 'restarting'
                          ? '正在重启'
                          : '正在更新'
                        : updateStatus?.state === 'error'
                          ? '重试更新'
                          : '检测更新'}
                  </span>
                </Button>
              )}
            </div>
            {updateStatus ? (
              <div className="about-update" data-state={updateStatus.state}>
                <div aria-live="polite" className="about-update__status" role="status">
                  <span>
                    {cancellingUpdate
                      ? '正在取消下载...'
                      : updateStatus.message ||
                        (updateStatus.state === 'installing'
                          ? '正在安装更新'
                          : updateStatus.state === 'restarting'
                            ? '更新完成，正在重启'
                            : '正在下载更新')}
                  </span>
                  {updateStatus.state === 'downloading' && updateStatus.totalBytes > 0 ? (
                    <span>{Math.round(updateStatus.progress)}%</span>
                  ) : null}
                </div>
                {updating ? (
                  <ProgressBar
                    label="应用更新进度"
                    size="sm"
                    value={
                      updateStatus.state === 'downloading' && updateStatus.totalBytes > 0
                        ? updateStatus.progress
                        : undefined
                    }
                    valueLabel={updateStatus.message}
                  />
                ) : null}
                {updating && updateStatus.state === 'downloading' ? (
                  <Button
                    className="about-update__cancel"
                    onClick={() => void cancelUpdate()}
                    pending={cancellingUpdate}
                    size="sm"
                    variant="ghost"
                  >
                    取消下载
                  </Button>
                ) : null}
              </div>
            ) : null}
          </SettingsGroup>

          <SettingsGroup
            flush
            footer={
              <span className="settings-group__note">
                © {new Date().getFullYear()} PrimordialWeave · All rights reserved
              </span>
            }
          >
            <ul className="settings-list">
              <li className="settings-row">
                <span className="settings-row__title">作者</span>
                <span className="settings-row__value">willxue</span>
              </li>
              <li className="settings-row">
                <span className="settings-row__title">微信公众号</span>
                <span aria-busy={!brandingLoaded} className="settings-row__value">
                  {brandingLoaded ? wechatPublicAccount : <Skeleton height="1rem" width="6rem" />}
                </span>
              </li>
              <li className="settings-row">
                <span className="settings-row__title" id={`${rowId}-source-title`}>
                  开源地址
                </span>
                <Button
                  aria-describedby={`${rowId}-source-title`}
                  onClick={openGitHub}
                  size="sm"
                  variant="outline"
                >
                  <span>primordialweave/zhusuan</span>
                  <JadeIcon name="arrow-up-right" size="1em" />
                </Button>
              </li>
              <li className="settings-row">
                <span className="settings-row__title">技术栈</span>
                <div className="settings-row__value">
                  {techStack.map((tech) => (
                    <Chip key={tech} size="sm">
                      {tech}
                    </Chip>
                  ))}
                </div>
              </li>
            </ul>
          </SettingsGroup>
        </div>
      )
    }

    if (!profileLoaded && !user) {
      return (
        <div className="settings-page">
          <SettingsGroup>
            <div
              aria-busy="true"
              aria-label="正在加载账户概览"
              className="settings-account"
              role="status"
            >
              <Skeleton
                className="settings-loading__avatar"
                height="var(--ods-space-10)"
                shape="circle"
                width="var(--ods-space-10)"
              />
              <div className="settings-account__copy">
                <span className="settings-account__name settings-loading__account-name">
                  <Skeleton height="var(--ods-font-size-lg)" width="7rem" />
                </span>
                <span className="settings-account__meta settings-loading__account-meta">
                  <Skeleton height="var(--ods-font-size-sm)" width="4rem" />
                  <Skeleton height="var(--ods-space-5)" width="3rem" />
                </span>
              </div>
              <Skeleton
                className="settings-loading__account-action"
                height="var(--ods-control-height-md)"
                width="7.5rem"
              />
            </div>
          </SettingsGroup>
          <SettingsGroup
            footer={<Skeleton height="var(--ods-control-height-md)" width="7.5rem" />}
            title="个人信息"
          >
            <SettingsFormSkeleton columns={3} fields={5} label="正在加载个人信息" />
          </SettingsGroup>
          <SettingsGroup
            footer={<Skeleton height="var(--ods-control-height-md)" width="7.5rem" />}
            title="安全设置"
          >
            <SettingsFormSkeleton columns={3} fields={3} label="正在加载账户信息" />
          </SettingsGroup>
        </div>
      )
    }

    if (!user) {
      return (
        <SettingsGroup title="个人信息">
          <EmptyState
            action={
              <Button onClick={() => void loadProfile()} variant="secondary">
                重新加载个人信息
              </Button>
            }
            className="settings-empty"
            description="暂时无法读取账户资料，请重试。"
            icon={<JadeIcon name="warning" size="1em" />}
            title="个人信息加载失败"
          />
        </SettingsGroup>
      )
    }

    return (
      <div className="settings-page">
        <SettingsGroup>
          <div className="settings-account">
            <Avatar
              name={user?.name || user?.username}
              src={user?.avatar || undefined}
              tone="accent"
            />
            <div className="settings-account__copy">
              <span className="settings-account__name">
                {user?.name || user?.username || '未登录'}
              </span>
              <span className="settings-account__meta">
                <span>{user?.username}</span>
                <Chip size="sm" tone={isAdmin ? 'accent' : 'neutral'}>
                  {isAdmin ? '管理员' : '普通用户'}
                </Chip>
              </span>
            </div>
            <Button onClick={() => void handleLogout()} tone="danger" variant="outline">
              <JadeIcon name="logout" size="1em" />
              <span>退出登录</span>
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup
          footer={
            <>
              {profileDirty ? (
                <span className="settings-unsaved-indicator" role="status">
                  <JadeIcon name="edit-circle" size="1em" />
                  有尚未保存的个人信息更改
                </span>
              ) : null}
              <Button onClick={saveProfile}>
                <JadeIcon name="save" size="1em" />
                <span>保存更改</span>
              </Button>
            </>
          }
          title="个人信息"
        >
          <FormGrid columns={3}>
            {profileField('name', '姓名', 'text')}
            {profileField('position', '职位', 'text')}
            {profileField('department', '部门', 'text')}
            {profileField('email', '邮箱', 'email')}
            {profileField('phone', '手机', 'tel')}
          </FormGrid>
        </SettingsGroup>

        <SettingsGroup
          footer={
            <Button onClick={handlePasswordChange}>
              <JadeIcon name="lock-password" size="1em" />
              <span>修改密码</span>
            </Button>
          }
          title="安全设置"
        >
          <FormGrid columns={3}>
            {passwordField('oldPassword', '当前密码', '请输入当前密码')}
            {passwordField('newPassword', '新密码', '至少 6 位')}
            {passwordField('confirmPassword', '确认新密码', '再次输入新密码')}
          </FormGrid>
        </SettingsGroup>
      </div>
    )
  }

  return (
    <Tabs.Root
      className="settings-workspace"
      data-motion-scope="settings"
      onValueChange={selectTab}
      value={activeTab}
    >
      <aside className="settings-rail">
        <PageHeader title="系统设置" />
        <Tabs.List
          aria-label="设置分类"
          orientation={stacked ? 'horizontal' : 'vertical'}
          variant={stacked ? 'underline' : 'navigation'}
        >
          {settingsNav.map((item) => (
            <Tabs.Tab key={item.key} value={item.key}>
              {stacked ? null : <JadeIcon name={item.icon} size={18} />}
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </aside>

      <div className="settings-content settings-view">
        <Tabs.Panel value={activeTab}>
          <div className="settings-panel-frame" key={activeTab}>
            {activePanel()}
          </div>
        </Tabs.Panel>
      </div>
    </Tabs.Root>
  )
}
