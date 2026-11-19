import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useAppearanceStore } from '@/stores/appearance'
import '@/styles/scene.css'
import SceneGreeter from './SceneGreeter'
import { useSceneRuntime } from './useSceneRuntime'

export interface JiangnanSceneProps {
  /** The workbench shows the full scene and may animate; business pages get the soft still. */
  variant: 'workbench' | 'business'
}

/** The 烟雨江南 backdrop. The still always paints first; animation is an optional layer on top. */
export default function JiangnanScene({ variant }: JiangnanSceneProps) {
  const sceneMotion = useAppearanceStore((state) => state.sceneMotion)
  const reducedMotion = useReducedMotion()
  const animate = variant === 'workbench' && sceneMotion && !reducedMotion
  const { glCanvasRef, layers, rainCanvasRef } = useSceneRuntime(animate)

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
      {variant === 'workbench' ? <SceneGreeter crop="cover" waving={animate} /> : null}
      <div className="jiangnan-scene__veil" />
    </div>
  )
}
