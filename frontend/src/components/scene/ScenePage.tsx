import { useId, type ReactNode } from 'react'
import { handleWindowDragRegionDoubleClick } from '@/components/layout/windowDrag'
import { CloudPanel } from '@/design-system'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { getScenePageCrop } from '@/scene/sceneFrame'
import { useAppearanceStore } from '@/stores/appearance'
import SceneGreeter from './SceneGreeter'
import { useSceneRuntime } from './useSceneRuntime'
import '@/styles/scene-page.css'

export interface ScenePageProps {
  /** Centres the card's content; the sign-in form keeps it at the start edge. */
  align?: 'center' | 'start'
  children: ReactNode
  /** Id of the heading that names the card. */
  labelledBy: string
}

/**
 * A page outside the app shell: the scene with one frosted card in the right column and no
 * Dock. The scene moves as it does on the workbench, and the girl on the bridge waves.
 */
export default function ScenePage({ align = 'start', children, labelledBy }: ScenePageProps) {
  const sceneMotion = useAppearanceStore((state) => state.sceneMotion)
  const reducedMotion = useReducedMotion()
  const animate = sceneMotion && !reducedMotion
  const { glCanvasRef, layers, rainCanvasRef } = useSceneRuntime(animate, getScenePageCrop)

  return (
    <main className="scene-page">
      <div aria-hidden="true" className="scene-page__still">
        {animate ? (
          <>
            <canvas
              className="scene-page__layer"
              data-active={layers.gl || undefined}
              ref={glCanvasRef}
            />
            <canvas
              className="scene-page__layer"
              data-active={layers.rain || undefined}
              ref={rainCanvasRef}
            />
          </>
        ) : null}
        <SceneGreeter crop="page" waving={animate} />
      </div>
      <div className="app-titlebar-drag-region" onDoubleClick={handleWindowDragRegionDoubleClick} />
      <CloudPanel
        aria-labelledby={labelledBy}
        backdrop={
          <>
            <span className="scene-page__plum" />
            <span className="scene-page__hills" />
          </>
        }
        className="scene-page__card"
        data-align={align}
      >
        {children}
      </CloudPanel>
    </main>
  )
}

/** The tapered brush stroke under a card heading; it thins and fades towards its end. */
export function BrushStroke() {
  // The id goes into a url() reference, so keep it to characters every engine accepts there.
  const fade = `brush-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg aria-hidden="true" className="scene-page__stroke" focusable="false" viewBox="0 0 117 16">
      <defs>
        <linearGradient id={fade} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path
        d="M0 14C7 6 15 1 26 1C48 1 62 9 84 8C97 7.4 108 4 117 3C108 6 97 9.6 84 10C62 11 46 6.5 27 7C17 7.3 8 11.5 1.5 16Z"
        fill={`url(#${fade})`}
      />
    </svg>
  )
}
