import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import ScenePage, { BrushStroke } from '@/components/scene/ScenePage'
import { Alert, Button, Checkbox, IconButton, Input, InputGroup } from '@/design-system'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/composables/useToast'
import { rememberedLogin } from '@/utils/rememberedLogin'

const getLastUsername = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('lastUsername') || ''
}

export default function LoginView() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const loading = useAuthStore((state) => state.loading)
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn)
  const toastWarning = useToastStore((state) => state.warning)
  const canRememberPassword = rememberedLogin.isAvailable()
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState(getLastUsername)
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(Boolean(getLastUsername()))
  const [rememberPassword, setRememberPassword] = useState(
    () => canRememberPassword && window.localStorage.getItem('rememberPassword') === 'true',
  )
  const [restoring, setRestoring] = useState(rememberPassword)
  const [submitting, setSubmitting] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const editedRef = useRef(false)
  const autofilledRef = useRef(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (!canRememberPassword || window.localStorage.getItem('rememberPassword') !== 'true') return
    let active = true
    void rememberedLogin
      .load()
      .then((credentials) => {
        if (!active || editedRef.current) return
        if (credentials && credentials.username === getLastUsername()) {
          setUsername(credentials.username)
          setPassword(credentials.password)
          autofilledRef.current = true
          setRememberMe(true)
        } else {
          setRememberPassword(false)
          window.localStorage.removeItem('rememberPassword')
        }
      })
      .catch(() => {
        if (active) toastWarning('无法读取已保存的密码，请手动输入')
      })
      .finally(() => {
        if (active) setRestoring(false)
      })
    return () => {
      active = false
    }
  }, [canRememberPassword, toastWarning])

  const forgetPassword = async (forgetUsername = false) => {
    editedRef.current = true
    setForgetting(true)
    try {
      if (canRememberPassword && window.localStorage.getItem('rememberPassword') === 'true') {
        await rememberedLogin.clear()
      }
      window.localStorage.removeItem('rememberPassword')
      setRememberPassword(false)
      if (forgetUsername) {
        window.localStorage.removeItem('lastUsername')
        setRememberMe(false)
      }
    } catch {
      toastWarning('清除已保存的密码失败，请重试')
    } finally {
      setForgetting(false)
    }
  }

  if (isLoggedIn && !submitting) {
    return <Navigate replace to="/dashboard" />
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading || submitting || restoring || forgetting) return
    editedRef.current = true
    setSubmitting(true)
    setLoginError('')

    try {
      const success = await login({ username, password })
      if (success) {
        if (rememberMe || rememberPassword) {
          window.localStorage.setItem('lastUsername', username)
        } else {
          window.localStorage.removeItem('lastUsername')
        }
        if (rememberPassword && canRememberPassword) {
          try {
            await rememberedLogin.save({ username, password })
            window.localStorage.setItem('rememberPassword', 'true')
          } catch {
            window.localStorage.removeItem('rememberPassword')
            toastWarning('登录成功，但未能记住密码，请检查系统凭据存储')
          }
        }
        await navigate('/dashboard')
        return
      }
      setLoginError(useAuthStore.getState().error || '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScenePage labelledBy="login-title">
      <header>
        <h1 className="scene-page__title" id="login-title">
          欢迎回来
        </h1>
        <BrushStroke />
      </header>

      <form className="login-form" onSubmit={handleLogin}>
        <InputGroup
          adornmentSpacing="balanced"
          focusAdornmentTone="accent"
          size="lg"
          startContent={<i aria-hidden="true" className="ri-user-line" />}
        >
          <Input
            aria-label="用户名 / 邮箱 / 手机号"
            autoCapitalize="off"
            autoComplete="username"
            autoCorrect="off"
            name="username"
            disabled={submitting || forgetting}
            onChange={(event) => {
              editedRef.current = true
              setUsername(event.target.value)
              if (autofilledRef.current) {
                setPassword('')
                autofilledRef.current = false
              }
            }}
            placeholder="用户名 / 邮箱 / 手机号"
            size="lg"
            spellCheck={false}
            type="text"
            value={username}
          />
        </InputGroup>

        <InputGroup
          adornmentSpacing="balanced"
          endContent={
            <IconButton
              label={showPassword ? '隐藏密码' : '显示密码'}
              onClick={() => setShowPassword((value) => !value)}
              size="md"
              variant="ghost"
            >
              <i className={showPassword ? 'ri-eye-line' : 'ri-eye-off-line'} />
            </IconButton>
          }
          focusAdornmentTone="accent"
          size="lg"
          startContent={<i aria-hidden="true" className="ri-lock-line" />}
        >
          <Input
            aria-label="密码"
            autoCapitalize="off"
            autoComplete="current-password"
            autoCorrect="off"
            name="password"
            disabled={submitting || forgetting}
            onChange={(event) => {
              editedRef.current = true
              autofilledRef.current = false
              setPassword(event.target.value)
            }}
            placeholder="密码"
            size="lg"
            spellCheck={false}
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
        </InputGroup>

        <div className="login-form__options">
          <Checkbox
            checked={rememberMe}
            disabled={submitting || restoring || forgetting}
            onChange={(event) => {
              editedRef.current = true
              if (event.target.checked) setRememberMe(true)
              else void forgetPassword(true)
            }}
          >
            记住用户名
          </Checkbox>
          <Checkbox
            checked={rememberPassword}
            disabled={!canRememberPassword || submitting || restoring || forgetting}
            onChange={(event) => {
              editedRef.current = true
              if (event.target.checked) {
                setRememberPassword(true)
                setRememberMe(true)
              } else {
                void forgetPassword()
              }
            }}
            title={
              canRememberPassword
                ? '在此设备的系统凭据存储中保存密码'
                : '请在桌面客户端使用；网页版可使用浏览器密码管理器'
            }
          >
            记住密码
          </Checkbox>
        </div>

        {loginError ? (
          <Alert icon={<i className="ri-error-warning-line" />} title={loginError} tone="danger" />
        ) : null}

        <Button
          fullWidth
          pending={loading || submitting || restoring || forgetting}
          size="lg"
          type="submit"
          variant="primary"
        >
          {loading || submitting ? '登录中...' : restoring ? '读取登录信息...' : '登录'}
        </Button>
      </form>
    </ScenePage>
  )
}
