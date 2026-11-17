import { useEffect, useRef, useState } from 'react'
import masksUrl from '@/assets/jiangnan/scene-masks.webp'
import sceneUrl from '@/assets/jiangnan/scene.webp'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useAppearanceStore } from '@/stores/appearance'
import '@/styles/scene.css'

export interface JiangnanSceneProps {
  /** The workbench shows the full scene and may animate; business pages get the soft still. */
  variant: 'workbench' | 'business'
}

const canAnimate = () =>
  typeof window !== 'undefined' &&
  ('WebGL2RenderingContext' in window || 'CanvasRenderingContext2D' in window)

/** The 烟雨江南 backdrop. The still always paints first; animation is an optional layer on top. */
export default function JiangnanScene({ variant }: JiangnanSceneProps) {
  const sceneMotion = useAppearanceStore((state) => state.sceneMotion)
  const reducedMotion = useReducedMotion()
  const glCanvasRef = useRef<HTMLCanvasElement>(null)
  const rainCanvasRef = useRef<HTMLCanvasElement>(null)
  const [layers, setLayers] = useState({ gl: false, rain: false })
  const animate = variant === 'workbench' && sceneMotion && !reducedMotion

  useEffect(() => {
    const glCanvas = glCanvasRef.current
    const rainCanvas = rainCanvasRef.current
    if (!animate || !glCanvas || !rainCanvas || !canAnimate()) return

    const controller = new AbortController()
    let cancelled = false
    let dispose: (() => void) | undefined
    // The renderer is a separate chunk so pages that never animate do not load it.
    void import('@/scene/sceneRuntime')
      .then(({ startSceneRuntime }) =>
        startSceneRuntime({
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
        // Animation is decorative: on any failure the still stays and the app carries on.
      })

    return () => {
      cancelled = true
      controller.abort()
      dispose?.()
      setLayers({ gl: false, rain: false })
    }
  }, [animate])

  return (
    <div aria-hidden="true" className="jiangnan-scene" data-variant={variant}>
      <div className="jiangnan-scene__still" />
      {animate ? (
        <>
          <canvas
            className="jiangnan-scene__layer"
            data-active={layers.gl || undefined}
            ref={glCanvasRef}
          />
          <canvas
            className="jiangnan-scene__layer"
            data-active={layers.rain || undefined}
            ref={rainCanvasRef}
          />
        </>
      ) : null}
      <div className="jiangnan-scene__veil" />
    </div>
  )
}
