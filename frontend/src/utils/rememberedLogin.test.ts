import { afterEach, describe, expect, it, vi } from 'vitest'
import { CredentialStore } from '../../bindings/github.com/FruitsAI/Orange/internal/desktop'
import { rememberedLogin } from './rememberedLogin'

vi.mock('../../bindings/github.com/FruitsAI/Orange/internal/desktop', () => ({
  CredentialStore: { Load: vi.fn(), Save: vi.fn(), Clear: vi.fn() },
}))

describe('rememberedLogin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('enables the system keyring only in a native Wails environment', () => {
    vi.stubGlobal('_wails', {})
    expect(rememberedLogin.isAvailable()).toBe(false)
    for (const OS of ['darwin', 'windows', 'linux']) {
      vi.stubGlobal('_wails', { environment: { OS } })
      expect(rememberedLogin.isAvailable()).toBe(true)
    }
  })

  it('sends credentials to typed native bindings scoped to the API server', async () => {
    const credentials = { username: 'admin', password: 'test-password' }
    vi.mocked(CredentialStore.Load).mockResolvedValue(credentials)
    await rememberedLogin.save(credentials)
    expect(await rememberedLogin.load()).toEqual(credentials)
    await rememberedLogin.clear()
    expect(CredentialStore.Save).toHaveBeenCalledWith('orange-desktop/api/v1', credentials)
    expect(CredentialStore.Load).toHaveBeenCalledWith('orange-desktop/api/v1')
    expect(CredentialStore.Clear).toHaveBeenCalledWith('orange-desktop/api/v1')
  })
})
