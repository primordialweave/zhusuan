import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Browser } from '@wailsio/runtime'
import api, { type ApiResponse } from '@/api'
import type { User } from '@/api/auth'
import DataSyncPanel from '@/components/settings/DataSyncPanel'
import DictionaryManagement from '@/components/settings/DictionaryManagement'
import NotificationManagement from '@/components/settings/NotificationManagement'
import TokenManagement from '@/components/settings/TokenManagement'
import UserManagement from '@/components/settings/UserManagement'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/composables/useToast'
import {
  Button,
  Chip,
  Field,
  FormGrid,
  Image,
  Input,
  PageHeader,
  RouterButton,
  SegmentedControl,
  Switch,
  Tabs,
  User as UserBadge,
} from '@/design-system'
import { useAppearanceStore, type AppearancePreferences } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'
import { THEME_OPTIONS, useThemeStore } from '@/stores/theme'
import '@/styles/settings.css'
import pkg from '../../package.json'

const techStack = ['Wails v3', 'React', 'TypeScript', 'Go']

const appearanceSwitches: ReadonlyArray<{
  description: string
  key: keyof AppearancePreferences
  title: string
}> = [
  {
    description: '在工作台播放雨丝、水波和柳枝动画',
    key: 'sceneMotion',
    title: '江南动态场景',
  },
  {
    description: '保留静态雨景，减少背景动效',
    key: 'reduceMotion',
    title: '减少动态效果',
  },
  {
    description: '在底部导航显示透明与折射',
    key: 'liquidGlass',
    title: '液态玻璃效果',
  },
]

interface ReleaseInfo {
  html_url: string
  tag_name: string
}

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
  const [profileForm, setProfileForm] = useState(() => createProfileFormState(user))
  const profile = profileForm.draft
  const originalProfile = profileForm.baseline
  const [securityForm, setSecurityForm] = useState({
    confirmPassword: '',
    newPassword: '',
    oldPassword: '',
  })
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshUser()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshUser])

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
    () => [
      { key: 'profile', label: '个人信息' },
      { key: 'security', label: '安全设置' },
      { key: 'appearance', label: '外观设置' },
      { key: 'notification', label: '通知设置' },
      { key: 'data-sync', label: '数据同步' },
      ...(isAdmin
        ? [
            { key: 'users', label: '用户管理' },
            { key: 'dictionary', label: '字典管理' },
          ]
        : []),
      { key: 'developer', label: '开发设置' },
      { key: 'about', label: '关于' },
    ],
    [isAdmin],
  )

  const requestedTab = searchParams.get('tab')
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
    openExternalUrl('https://github.com/FruitsAI/Orange')
  }

  const checkUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const { data } = await api.get<ApiResponse<ReleaseInfo>>('/system/updates/check')
      const releaseInfo = data.data
      const latestVersionTag = releaseInfo.tag_name
      const cleanLatest = latestVersionTag.replace(/^v/, '')
      const cleanCurrent = pkg.version.replace(/^v/, '')

      if (cleanLatest === cleanCurrent) {
        toastSuccess(`当前已是最新版本 (v${cleanLatest})`)
        return
      }

      const confirmed = await confirm({
        message: `检测到新版本 ${latestVersionTag}，当前版本 v${cleanCurrent}。是否前往下载？`,
        title: '发现新版本',
      })

      if (confirmed) {
        openExternalUrl(releaseInfo.html_url)
      }
    } catch {
      toastError('检查更新失败，请稍后重试')
    } finally {
      setCheckingUpdate(false)
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
                <i aria-hidden="true" className="ri-arrow-right-line" />
              </RouterButton>
            }
          />
        </section>
      )
    }

    if (activeTab === 'security') {
      return (
        <section aria-label="安全设置" className="settings-form">
          <FormGrid columns={3}>
            {passwordField('oldPassword', '当前密码', '请输入当前密码')}
            {passwordField('newPassword', '新密码', '请输入新密码（至少6位）')}
            {passwordField('confirmPassword', '确认新密码', '请再次输入新密码')}
          </FormGrid>
          <div className="settings-form__actions">
            <Button onClick={handlePasswordChange}>
              <i aria-hidden="true" className="ri-lock-password-line" />
              <span>修改密码</span>
            </Button>
          </div>
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
        <section aria-label="外观设置" className="settings-appearance">
          <ul className="settings-list">
            <li className="settings-row">
              <span className="settings-row__title">界面主题</span>
              <SegmentedControl
                aria-label="界面主题"
                onValueChange={setTheme}
                options={THEME_OPTIONS}
                value={theme}
              />
            </li>
            {appearanceSwitches.map((item) => (
              <li className="settings-row" key={item.key}>
                <div className="settings-row__copy">
                  <span className="settings-row__title" id={`${rowId}-${item.key}-title`}>
                    {item.title}
                  </span>
                  <span
                    className="settings-row__description"
                    id={`${rowId}-${item.key}-description`}
                  >
                    {item.description}
                  </span>
                </div>
                <Switch
                  aria-describedby={`${rowId}-${item.key}-description`}
                  aria-labelledby={`${rowId}-${item.key}-title`}
                  checked={appearance[item.key]}
                  onChange={(event) => appearance.setPreference(item.key, event.target.checked)}
                  size="lg"
                />
              </li>
            ))}
          </ul>
          <div aria-label="江南场景预览" className="settings-preview" role="img" />
        </section>
      )
    }

    if (activeTab === 'about') {
      return (
        <section aria-label="关于" className="settings-about">
          <div className="about-hero">
            <Image alt="" className="about-logo" src="/orange.png" />
            <div className="about-hero__copy">
              <h2 className="about-title">Orange</h2>
              <span className="about-tagline">小旭姐专属记账工具</span>
            </div>
            <div className="about-hero__version">
              <Chip size="sm" tone="accent">
                v{pkg.version}
              </Chip>
              <Button
                onClick={() => void checkUpdate()}
                pending={checkingUpdate}
                size="sm"
                variant="outline"
              >
                <i
                  aria-hidden="true"
                  className={`ri-loop-left-line ${checkingUpdate ? 'spinning' : ''}`}
                />
                <span>{checkingUpdate ? '正在检测更新...' : '检测更新'}</span>
              </Button>
            </div>
          </div>

          <ul className="settings-list">
            <li className="settings-row">
              <span className="settings-row__title">作者</span>
              <span className="settings-row__value">willxue</span>
            </li>
            <li className="settings-row">
              <span className="settings-row__title">微信公众号</span>
              <span className="settings-row__value">为学书院</span>
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
                <span>FruitsAI/Orange</span>
                <i aria-hidden="true" className="ri-arrow-right-up-line" />
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

          <p className="about-copyright">
            © {new Date().getFullYear()} FruitsAI · All rights reserved
          </p>
        </section>
      )
    }

    return (
      <section aria-label="个人信息" className="settings-form">
        <FormGrid columns={3}>
          {profileField('name', '姓名', 'text')}
          {profileField('position', '职位', 'text')}
          {profileField('department', '部门', 'text')}
          {profileField('email', '邮箱', 'email')}
          {profileField('phone', '手机', 'tel')}
        </FormGrid>
        <div className="settings-form__actions">
          <Button onClick={saveProfile}>
            <i aria-hidden="true" className="ri-save-line" />
            <span>保存更改</span>
          </Button>
        </div>

        <ul className="settings-list">
          <li className="settings-row">
            <UserBadge
              avatarProps={{ name: user?.name || user?.username, src: user?.avatar || undefined }}
              description={user?.username}
              name={user?.name || user?.username || '未登录'}
            />
            <Button onClick={() => void handleLogout()} tone="danger" variant="outline">
              <i aria-hidden="true" className="ri-logout-box-r-line" />
              <span>退出登录</span>
            </Button>
          </li>
        </ul>
      </section>
    )
  }

  return (
    <div className="settings-workspace" data-motion-scope="settings">
      <PageHeader description="管理账户和界面偏好" title="系统设置" />

      <Tabs.Root className="settings-view" onValueChange={selectTab} value={activeTab}>
        <Tabs.List aria-label="设置分类" variant="underline">
          {settingsNav.map((item) => (
            <Tabs.Tab key={item.key} value={item.key}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel className="settings-content" value={activeTab}>
          <div className="settings-panel-frame" key={activeTab}>
            {activeTab === 'profile' && profileDirty ? (
              <div className="settings-unsaved-indicator" role="status">
                <i aria-hidden="true" className="ri-edit-circle-line" />
                有尚未保存的个人信息更改
              </div>
            ) : null}
            {activePanel()}
          </div>
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  )
}
