import api, { type ApiResponse } from './index'

export interface SystemInfo {
  version: string
  slogan: string
  wechat_public_account: string
}

export const DEFAULT_APP_SLOGAN = '心中有数，账目有序'
export const DEFAULT_WECHAT_PUBLIC_ACCOUNT = '原初织界'

export const systemApi = {
  info: () => api.get<ApiResponse<SystemInfo>>('/system/info'),
}
