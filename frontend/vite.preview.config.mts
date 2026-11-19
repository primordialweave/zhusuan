// Browser-preview config: proxies /api to a local Go server so the preview origin does not need
// to be on the backend CORS allowlist. PREVIEW_API_TARGET points it at a server other than the
// desktop app's own (which serves the real database); PREVIEW_CACHE_DIR keeps a second Vite
// instance from sharing the dependency cache of one that is already running.
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

const target = process.env.PREVIEW_API_TARGET ?? 'http://localhost:3456'
const cacheDir = process.env.PREVIEW_CACHE_DIR

export default defineConfig((env) =>
  mergeConfig(typeof base === 'function' ? base(env) : base, {
    ...(cacheDir ? { cacheDir } : {}),
    server: { proxy: { '/api': target } },
  }),
)
