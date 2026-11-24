/**
 * @file stores/auth.ts
 * @description React/Zustand user authentication state.
 */
import { create } from 'zustand'
import { authApi, type LoginRequest, type User } from '@/api/auth'
import {
  clearAuthStorage,
  getStoredToken,
  getStoredUser,
  saveAuthState,
  saveStoredUser,
} from '@/utils/authStorage'

interface AuthState {
  token: string | null
  user: User | null
  loading: boolean
  error: string | null
  isLoggedIn: boolean
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  captureSession: () => AuthSessionSnapshot
  syncCurrentUser: (user: User, session: AuthSessionSnapshot) => boolean
  updateProfile: (data: {
    name?: string
    email?: string
    phone?: string
    department?: string
    position?: string
  }) => Promise<boolean>
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>
}

export interface AuthSessionSnapshot {
  token: string | null
  userId: number | null
  generation: number
}

const storedToken = getStoredToken()

const setAuthSession = (token: string | null, user: User | null) => ({
  token,
  user,
  isLoggedIn: Boolean(token),
  isAuthenticated: Boolean(token),
})

export const useAuthStore = create<AuthState>((set, get) => {
  let sessionGeneration = 0
  let profileRevision = 0
  let refreshRequest = 0
  let profileRequest = 0
  let passwordRequest = 0
  let loginRequest = 0
  const captureSession = (): AuthSessionSnapshot => ({
    token: get().token,
    userId: get().user?.id ?? null,
    generation: sessionGeneration,
  })
  const sessionMatches = (session: AuthSessionSnapshot) => {
    const current = captureSession()
    return (
      current.token === session.token &&
      current.userId === session.userId &&
      current.generation === session.generation
    )
  }
  const syncCurrentUser = (user: User, session: AuthSessionSnapshot) => {
    if (
      !session.token ||
      !sessionMatches(session) ||
      (session.userId !== null && user.id !== session.userId)
    )
      return false
    profileRevision += 1
    refreshRequest += 1
    if (user.status === 0) {
      sessionGeneration += 1
      clearAuthStorage()
      set({ ...setAuthSession(null, null), loading: false, error: null })
    } else {
      saveStoredUser(user)
      set({ user, loading: false })
    }
    return true
  }
  return {
    ...setAuthSession(storedToken, getStoredUser<User>()),
    loading: false,
    error: null,
    captureSession,
    syncCurrentUser,

    async login(credentials) {
      const request = ++loginRequest
      const generation = sessionGeneration
      const isCurrentLogin = () => request === loginRequest && generation === sessionGeneration
      set({ loading: true, error: null })

      try {
        const response = await authApi.login(credentials)
        if (!isCurrentLogin()) return false
        const { token, user } = response.data.data

        sessionGeneration += 1
        profileRevision += 1
        refreshRequest += 1
        saveAuthState(token, user)
        set({ ...setAuthSession(token, user), loading: false })
        return true
      } catch (err: unknown) {
        if (!isCurrentLogin()) return false
        set({
          error: err instanceof Error ? err.message : '登录失败',
          loading: false,
        })
        return false
      }
    },

    async logout() {
      loginRequest += 1
      const session = captureSession()
      if (session.token) {
        try {
          await authApi.logout()
        } catch {
          // Local cleanup must still happen when the server session has already expired.
        }
      }

      if (!sessionMatches(session)) return
      sessionGeneration += 1
      profileRevision += 1
      refreshRequest += 1
      clearAuthStorage()
      set({ ...setAuthSession(null, null), error: null, loading: false })
    },

    async refreshUser() {
      const session = captureSession()
      if (!session.token) return
      const request = ++refreshRequest
      const revision = profileRevision

      try {
        const response = await authApi.getCurrentUser()
        if (!sessionMatches(session) || request !== refreshRequest || revision !== profileRevision)
          return
        if (session.userId !== null && response.data.data.id !== session.userId) return
        saveStoredUser(response.data.data)
        set({ user: response.data.data })
      } catch {
        // Auth failures are handled centrally; transient errors keep the last valid profile.
      }
    },

    async updateProfile(data) {
      const session = captureSession()
      const request = ++profileRequest
      const revision = profileRevision
      set({ loading: true, error: null })

      try {
        const response = await authApi.updateProfile(data)
        if (!sessionMatches(session) || request !== profileRequest || revision !== profileRevision)
          return false
        return syncCurrentUser(response.data.data, session)
      } catch (err: unknown) {
        if (!sessionMatches(session) || request !== profileRequest || revision !== profileRevision)
          return false
        set({
          error: err instanceof Error ? err.message : '更新失败',
          loading: false,
        })
        return false
      }
    },

    async changePassword(oldPassword, newPassword) {
      const session = captureSession()
      const request = ++passwordRequest
      set({ loading: true, error: null })

      try {
        await authApi.changePassword({
          old_password: oldPassword,
          new_password: newPassword,
        })
        if (!sessionMatches(session) || request !== passwordRequest) return false
        set({ loading: false })
        return true
      } catch (err: unknown) {
        if (!sessionMatches(session) || request !== passwordRequest) return false
        set({
          error: err instanceof Error ? err.message : '修改失败',
          loading: false,
        })
        return false
      }
    },
  }
})
