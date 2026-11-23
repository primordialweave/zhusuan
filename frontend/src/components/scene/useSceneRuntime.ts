import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_THEME_PACK,
  getThemePackMeta,
  loadThemePackAssets,
  type ConcreteThemePackId,
} from '@/config/themes'
import type { SceneCropFn } from '@/scene/sceneFrame'
import { useDesktopStore } from '@/stores/desktop'
import { isDesktopRuntime } from '@/utils/desktopManager'

const canAnimate = () =>
  typeof window !== 'undefined' &&
  ('WebGL2RenderingContext' in window || 'CanvasRenderingContext2D' in window)

/** Native windows wait for their existing initial state query before starting decorative work. */
export function useSceneAnimationEnabled(requested: boolean): boolean {
  const initialized = useDesktopStore((state) => state.state !== null)
  const hidden = useDesktopStore((state) => state.windowHidden)
  return requested && (!isDesktopRuntime() || (initialized && !hidden))
}

/**
 * Runs the animated scene on two canvases while `animate` holds. The renderer and non-default
 * theme assets are separate chunks, so inactive themes and static pages never load them; on any
 * failure the still stays.
 */
export function useSceneRuntime(
  animate: boolean,
  crop?: SceneCropFn,
  packId: ConcreteThemePackId = DEFAULT_THEME_PACK,
) {
  const glCanvasRef = useRef<HTMLCanvasElement>(null)
  const rainCanvasRef = useRef<HTMLCanvasElement>(null)
  const [layers, setLayers] = useState({ gl: false, rain: false })

  useEffect(() => {
    const glCanvas = glCanvasRef.current
    const rainCanvas = rainCanvasRef.current
    if (!animate || !glCanvas || !rainCanvas || !canAnimate()) return

    const pack = getThemePackMeta(packId)
    const controller = new AbortController()
    let cancelled = false
    let dispose: (() => void) | undefined
    void Promise.all([import('@/scene/sceneRuntime'), loadThemePackAssets(packId)])
      .then(([{ startSceneRuntime }, assets]) => {
        if (cancelled) return undefined
        return startSceneRuntime({
          crop,
          glCanvas,
          glOptions: pack.glOptions,
          masksUrl: assets.masksUrl,
          onActiveChange: (next) => {
            if (!cancelled) setLayers(next)
          },
          particlePreset: pack.particlePreset,
          rainCanvas,
          sceneUrl: assets.sceneUrl,
          signal: controller.signal,
        })
      })
      .then((runtime) => {
        if (!runtime) return
        if (cancelled) runtime.dispose()
        else dispose = runtime.dispose
      })
      .catch(() => {
        // Animation is decorative: the still remains and the app carries on.
      })

    return () => {
      cancelled = true
      controller.abort()
      dispose?.()
      setLayers({ gl: false, rain: false })
    }
  }, [animate, crop, packId])

  return { glCanvasRef, layers, rainCanvasRef }
}
