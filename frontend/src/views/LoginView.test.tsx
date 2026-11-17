import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@/test/render'
import { useAuthStore } from '@/stores/auth'
import { rememberedLogin } from '@/utils/rememberedLogin'
import { useToastStore } from '@/composables/useToast'
import LoginView from './LoginView'

vi.mock('@/utils/rememberedLogin', () => ({
  rememberedLogin: {
    isAvailable: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
  },
}))

const enterCredentials = () => {
  fireEvent.change(screen.getByRole('textbox', { name: '用户名 / 邮箱 / 手机号' }), {
    target: { value: 'admin' },
  })
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'test-password' } })
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.mocked(rememberedLogin.isAvailable).mockReturnValue(true)
    vi.mocked(rememberedLogin.load).mockResolvedValue(null)
    vi.mocked(rememberedLogin.save).mockResolvedValue()
    vi.mocked(rememberedLogin.clear).mockResolvedValue()
    useAuthStore.setState({
      error: null,
      isAuthenticated: false,
      isLoggedIn: false,
      loading: false,
      login: vi.fn().mockResolvedValue(true),
      token: null,
      user: null,
    })
  })

  it('remembers the password only after successful login without putting it in web storage', async () => {
    render(<LoginView />)
    enterCredentials()
    fireEvent.click(screen.getByRole('checkbox', { name: '记住密码' }))
    expect(screen.getByRole('checkbox', { name: '记住用户名' })).toBeChecked()
    expect(rememberedLogin.save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() =>
      expect(rememberedLogin.save).toHaveBeenCalledWith({
        username: 'admin',
        password: 'test-password',
      }),
    )
    expect(window.localStorage.getItem('lastUsername')).toBe('admin')
    expect(window.localStorage.getItem('rememberPassword')).toBe('true')
    expect(JSON.stringify(window.localStorage)).not.toContain('test-password')
    expect(JSON.stringify(window.sessionStorage)).not.toContain('test-password')
  })

  it('restores saved credentials and clears the autofilled password when changing accounts', async () => {
    window.localStorage.setItem('lastUsername', 'admin')
    window.localStorage.setItem('rememberPassword', 'true')
    vi.mocked(rememberedLogin.load).mockResolvedValue({
      username: 'admin',
      password: 'saved-password',
    })
    render(<LoginView />)

    await waitFor(() => expect(screen.getByLabelText('密码')).toHaveValue('saved-password'))
    expect(screen.getByRole('checkbox', { name: '记住密码' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '记住用户名' })).toBeChecked()
    fireEvent.change(screen.getByRole('textbox', { name: '用户名 / 邮箱 / 手机号' }), {
      target: { value: 'another-account' },
    })
    expect(screen.getByLabelText('密码')).toHaveValue('')
  })

  it.each(['记住密码', '记住用户名'])(
    'forgets a saved password immediately when unchecking %s',
    async (label) => {
      window.localStorage.setItem('lastUsername', 'admin')
      window.localStorage.setItem('rememberPassword', 'true')
      vi.mocked(rememberedLogin.load).mockResolvedValue({
        username: 'admin',
        password: 'saved-password',
      })
      render(<LoginView />)
      await waitFor(() => expect(screen.getByLabelText('密码')).toHaveValue('saved-password'))

      fireEvent.click(screen.getByRole('checkbox', { name: label }))
      await waitFor(() =>
        expect(screen.getByRole('checkbox', { name: '记住密码' })).not.toBeChecked(),
      )
      expect(rememberedLogin.clear).toHaveBeenCalledTimes(1)
      expect(window.localStorage.getItem('rememberPassword')).toBeNull()
      expect(window.localStorage.getItem('lastUsername')).toBe(
        label === '记住用户名' ? null : 'admin',
      )
    },
  )

  it('does not save an incorrect password after a failed login', async () => {
    useAuthStore.setState({ login: vi.fn().mockResolvedValue(false), error: '密码错误' })
    render(<LoginView />)
    enterCredentials()
    fireEvent.click(screen.getByRole('checkbox', { name: '记住密码' }))
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('密码错误'))
    expect(rememberedLogin.save).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('rememberPassword')).toBeNull()
  })

  it('does not overwrite user edits when saved credentials arrive late', async () => {
    let resolve!: (value: { username: string; password: string }) => void
    window.localStorage.setItem('lastUsername', 'admin')
    window.localStorage.setItem('rememberPassword', 'true')
    vi.mocked(rememberedLogin.load).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    render(<LoginView />)
    enterCredentials()

    await act(async () => {
      resolve({ username: 'admin', password: 'old-password' })
    })
    expect(screen.getByLabelText('密码')).toHaveValue('test-password')
  })

  it('disables password persistence in the browser preview', () => {
    vi.mocked(rememberedLogin.isAvailable).mockReturnValue(false)
    render(<LoginView />)
    expect(screen.getByRole('checkbox', { name: '记住密码' })).toBeDisabled()
    expect(rememberedLogin.load).not.toHaveBeenCalled()
  })

  it('finishes saving before redirecting even when login updates the auth store immediately', async () => {
    let finishSave!: () => void
    vi.mocked(rememberedLogin.save).mockReturnValue(
      new Promise((done) => {
        finishSave = done
      }),
    )
    useAuthStore.setState({
      login: vi.fn().mockImplementation(async () => {
        useAuthStore.setState({ isLoggedIn: true })
        return true
      }),
    })
    render(
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/dashboard" element={<h1>登录完成</h1>} />
      </Routes>,
      { initialEntries: ['/login'] },
    )
    enterCredentials()
    fireEvent.click(screen.getByRole('checkbox', { name: '记住密码' }))
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(rememberedLogin.save).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: '登录完成' })).not.toBeInTheDocument()
    await act(async () => {
      finishSave()
    })
    expect(screen.getByRole('heading', { name: '登录完成' })).toBeInTheDocument()
  })

  it('reports a keyring save failure without blocking a successful login', async () => {
    const warning = vi.spyOn(useToastStore.getState(), 'warning')
    vi.mocked(rememberedLogin.save).mockRejectedValue(new Error('keyring locked'))
    render(<LoginView />)
    enterCredentials()
    fireEvent.click(screen.getByRole('checkbox', { name: '记住密码' }))
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() =>
      expect(warning).toHaveBeenCalledWith('登录成功，但未能记住密码，请检查系统凭据存储'),
    )
    expect(window.localStorage.getItem('rememberPassword')).toBeNull()
    warning.mockRestore()
  })

  it('keeps the remembered state if deleting from the keyring fails', async () => {
    const warning = vi.spyOn(useToastStore.getState(), 'warning')
    window.localStorage.setItem('lastUsername', 'admin')
    window.localStorage.setItem('rememberPassword', 'true')
    vi.mocked(rememberedLogin.load).mockResolvedValue({
      username: 'admin',
      password: 'saved-password',
    })
    vi.mocked(rememberedLogin.clear).mockRejectedValue(new Error('keyring locked'))
    render(<LoginView />)
    await waitFor(() => expect(screen.getByLabelText('密码')).toHaveValue('saved-password'))
    fireEvent.click(screen.getByRole('checkbox', { name: '记住密码' }))
    await waitFor(() => expect(warning).toHaveBeenCalledWith('清除已保存的密码失败，请重试'))
    expect(screen.getByRole('checkbox', { name: '记住密码' })).toBeChecked()
    expect(window.localStorage.getItem('rememberPassword')).toBe('true')
    warning.mockRestore()
  })

  it('submits credentials and remembers the username with ODS form controls', async () => {
    const login = vi.fn().mockResolvedValue(true)
    useAuthStore.setState({ login })
    const { container } = render(<LoginView />, { initialEntries: ['/login'] })

    fireEvent.change(screen.getByRole('textbox', { name: '用户名 / 邮箱 / 手机号' }), {
      target: { value: 'admin' },
    })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '记住用户名' }))
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ password: 'admin123', username: 'admin' }),
    )
    expect(window.localStorage.getItem('lastUsername')).toBe('admin')
    // The fields are named by aria-label and their in-field text; no label sits above them.
    expect(container.querySelectorAll('.ods-field')).toHaveLength(0)
    expect(screen.getByPlaceholderText('用户名 / 邮箱 / 手机号')).toHaveAccessibleName(
      '用户名 / 邮箱 / 手机号',
    )
    expect(screen.getByPlaceholderText('密码')).toHaveAccessibleName('密码')
    expect(container.querySelectorAll('.ods-input')).toHaveLength(2)
    expect(container.querySelectorAll('.ods-input[data-size="lg"]')).toHaveLength(2)
    expect(container.querySelectorAll('.ods-input-group[data-size="lg"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-adornment-spacing="balanced"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-focus-adornment-tone="accent"]')).toHaveLength(2)
    expect(container.querySelector('.ods-checkbox')).toBeInTheDocument()
    expect(container.querySelector('.ods-button[type="submit"]')).toHaveAttribute('data-size', 'lg')
    expect(screen.getByRole('button', { name: '显示密码' })).toHaveAttribute('data-size', 'md')
    expect(container.querySelector('.input-wrapper')).not.toBeInTheDocument()
    expect(container.querySelector('.btn-primary-login')).not.toBeInTheDocument()
  })

  it('greets on a frosted card over the scene, with no brand block or theme switch', () => {
    const { container } = render(<LoginView />)

    const card = screen.getByRole('region', { name: '欢迎回来' })
    expect(card).toHaveClass('ods-cloud-panel')
    expect(screen.getByRole('heading', { level: 1, name: '欢迎回来' })).toBeInTheDocument()
    expect(screen.getByText('登录后继续查看项目与收款进度')).toBeInTheDocument()
    expect(container.querySelector('.scene-page__still')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /主题/ })).not.toBeInTheDocument()
  })

  it('offers only what the app can do: no demo entry, password reset link or security claim', () => {
    render(<LoginView />)

    expect(screen.queryByText('进入演示')).not.toBeInTheDocument()
    expect(screen.queryByText('忘记密码')).not.toBeInTheDocument()
    expect(screen.queryByText(/安全连接/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual(
      ['记住用户名', '记住密码'],
    )
  })

  it('toggles password visibility and reads the latest store error for consecutive failures', async () => {
    const login = vi
      .fn()
      .mockImplementationOnce(async () => {
        useAuthStore.setState({ error: '首次登录失败' })
        return false
      })
      .mockImplementationOnce(async () => {
        useAuthStore.setState({ error: '连续登录失败' })
        return false
      })
    useAuthStore.setState({ error: null, login })
    const { container } = render(<LoginView />)

    const password = screen.getByLabelText('密码')
    expect(password).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: '显示密码' }))
    expect(password).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('首次登录失败'))

    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('连续登录失败'))
    expect(login).toHaveBeenCalledTimes(2)
    expect(container.querySelector('.ods-alert')).toBeInTheDocument()
  })
})
