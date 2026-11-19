/**
 * @file api/index.ts
 * @description API 请求基础配置
 * 封装 Axios 实例，配置基础 URL、超时时间，并实现请求与响应拦截器。
 * 处理 Token 自动注入、统一错误处理以及登录过期跳转逻辑。
 */
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { API_BASE_URL } from '@/config/api'
import { clearAuthStorage, getStoredToken } from '@/utils/authStorage'

// API 统一响应结构
export interface ApiResponse<T = unknown> {
  code: number // 业务状态码 (0: 成功, 其他: 失败)
  message: string // 响应消息
  data: T // 响应数据
}

// 通用分页响应数据结构
export interface PageData<T> {
  list: T[] // 数据列表
  total: number // 总记录数
  page: number // 当前页码
  page_size: number // 每页条数
}

// 创建全局 Axios 实例
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`, // API 接口前缀
  timeout: 10000, // 请求超时时间 (10秒)
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：自动注入 JWT Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken()
    if (token && config.headers) {
      // 如果存在 Token，添加到 Authorization 头 (Bearer Schema)
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// 处理 Token 过期逻辑的全局回调
// 为了避免循环引用 (store 依赖 api, api 依赖 store)，此处采用 setter 注入方式
let authLogout: (() => void | Promise<void>) | null = null

export const setAuthLogout = (fn: () => void | Promise<void>) => {
  authLogout = fn
}

// 单飞保护：Token 失效瞬间往往有多个并发请求同时失败，
// 只让第一个触发登出/跳转，避免重复登出请求与多次路由跳转
let handlingAuthFailureForToken: string | null = null

const handleAuthFailure = async (config?: InternalAxiosRequestConfig) => {
  const authorization = config?.headers?.get?.('Authorization') ?? config?.headers?.Authorization
  const rejectedToken =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : null
  const currentToken = getStoredToken()
  // Login failures without a session and old responses must not terminate a fresh login.
  if (
    !currentToken ||
    rejectedToken !== currentToken ||
    handlingAuthFailureForToken === rejectedToken
  )
    return
  handlingAuthFailureForToken = rejectedToken

  try {
    if (authLogout) {
      await authLogout()
    } else {
      clearAuthStorage()
      window.location.href = '/login'
    }
  } catch {
    // A failed navigation/cleanup callback must not retain the rejected session.
    if (getStoredToken() === rejectedToken) clearAuthStorage()
  } finally {
    if (handlingAuthFailureForToken === rejectedToken) handlingAuthFailureForToken = null
  }
}

// 响应拦截器：处理业务错误和 Token 过期

api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { code, message } = response.data

    // 成功
    if (code === 0) {
      return response
    }

    // Token 无效 (2001) 或已过期 (2002)，统一登出
    if (code === 2001 || code === 2002) {
      void handleAuthFailure(response.config)
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    // 其他错误
    return Promise.reject(new Error(message || '请求失败'))
  },
  (error) => {
    const apiError = error.response?.data as Partial<ApiResponse> | undefined
    const code = apiError?.code

    if (error.response?.status === 401 || code === 2001 || code === 2002) {
      void handleAuthFailure(error.config ?? error.response?.config)
    }

    return Promise.reject(new Error(apiError?.message || error.message || '请求失败'))
  },
)

export default api
