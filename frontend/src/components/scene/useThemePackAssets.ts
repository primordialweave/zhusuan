import { useEffect, useState } from 'react'
import {
  getCachedThemePackAssets,
  loadThemePackAssets,
  SPRING_JIANGNAN_ASSETS,
  type ConcreteThemePackId,
  type ThemePackAssets,
} from '@/config/themes'

/**
 * Lazily resolves the WebP asset URLs for the active theme pack.
 * Spring Jiangnan resolves synchronously; other packs stay out of the initial network/decode path
 * until selected, keeping the previous still painted during the brief async load to avoid flicker.
 */
export function useThemePackAssets(packId: ConcreteThemePackId): {
  assets: ThemePackAssets
  ready: boolean
} {
  const cached = getCachedThemePackAssets(packId)
  const [resolved, setResolved] = useState<{
    assets: ThemePackAssets
    packId: ConcreteThemePackId
  }>(() => ({
    assets: cached ?? SPRING_JIANGNAN_ASSETS,
    packId: cached ? packId : 'spring-jiangnan',
  }))

  useEffect(() => {
    if (getCachedThemePackAssets(packId)) {
      return
    }

    let cancelled = false
    void loadThemePackAssets(packId)
      .then((assets) => {
        if (!cancelled) setResolved({ assets, packId })
      })
      .catch(() => {
        // Keep the current fallback painting if an optional theme asset fails to load.
      })

    return () => {
      cancelled = true
    }
  }, [packId])

  if (cached) {
    return { assets: cached, ready: true }
  }

  return {
    assets: resolved.assets,
    ready: resolved.packId === packId,
  }
}
