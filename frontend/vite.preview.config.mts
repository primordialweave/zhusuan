// Temporary browser-preview config: proxies /api to the local Go server so the
// preview origin does not need to be on the backend CORS allowlist.
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

export default defineConfig((env) =>
  mergeConfig(typeof base === 'function' ? base(env) : base, {
    server: { proxy: { '/api': 'http://localhost:3456' } },
  }),
)
