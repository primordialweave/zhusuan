import { CredentialStore } from '../../bindings/github.com/primordialweave/zhusuan/internal/desktop'
import { API_BASE_URL } from '@/config/api'
import type { LoginRequest } from '@/api/auth'

const scope = `${API_BASE_URL || 'zhusuan-desktop'}/api/v1`

export const rememberedLogin = {
  isAvailable() {
    const environment = (window as Window & { _wails?: { environment?: { OS?: string } } })._wails
      ?.environment
    return ['darwin', 'windows', 'linux'].includes(environment?.OS || '')
  },
  load: (): Promise<LoginRequest | null> => CredentialStore.Load(scope),
  save: (credentials: LoginRequest): Promise<void> => CredentialStore.Save(scope, credentials),
  clear: (): Promise<void> => CredentialStore.Clear(scope),
}
