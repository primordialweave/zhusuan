import { useEffect, useRef, useState } from 'react'
import masksUrl from '@/assets/jiangnan/scene-masks.webp'
import sceneUrl from '@/assets/jiangnan/scene.webp'
import type { SceneCropFn } from '@/scene/sceneFrame'

const canAnimate = () =>
  typeof window !== 'undefined' &&
  ('WebGL2RenderingContext' in window || 'CanvasRenderingContext2D' in window)

/**
 * Runs the animated scene on two canvases while `animate` holds. The renderer is a separate
 * chunk, so a page that never animates does not load it; on any failure the still stays.
 */
export function useSceneRuntime(animate: boolean, crop?: SceneCropFn) {
  const glCanvasRef = useRef<HTMLCanvasElement>(null)
  const rainCanvasRef = useRef<HTMLCanvasElement>(null)
  const [layers, setLayers] = useState({ gl: false, rain: false })

  useEffect(() => {
    const glCanvas = glCanvasRef.current
    const rainCanvas = rainCanvasRef.current
    if (!animate || !glCanvas || !rainCanvas || !canAnimate()) return

    const controller = new AbortController()
    let cancelled = false
    let dispose: (() => void) | undefined
    void import('@/scene/sceneRuntime')
      .then(({ startSceneRuntime }) =>
        startSceneRuntime({
          crop,
          glCanvas,
          masksUrl,
          onActiveChange: (next) => {
            if (!cancelled) setLayers(next)
          },
          rainCanvas,
          sceneUrl,
          signal: controller.signal,
        }),
      )
      .then((runtime) => {
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
  }, [animate, crop])

  return { glCanvasRef, layers, rainCanvasRef }
}
