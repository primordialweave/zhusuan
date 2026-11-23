import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getThemePackMeta, type ConcreteThemePackId } from '@/config/themes'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useAppearanceStore } from '@/stores/appearance'
import { useThemeStore } from '@/stores/theme'
import '@/styles/scene.css'
import SceneGreeter from './SceneGreeter'
import { useSceneAnimationEnabled, useSceneRuntime } from './useSceneRuntime'
import { useThemePackAssets } from './useThemePackAssets'

export interface JiangnanSceneProps {
  /** The workbench shows the full scene and may animate; business pages get the soft still. */
  variant: 'workbench' | 'business'
}

const CROSSFADE_MS = 460

interface DisplayedStill {
  packId: ConcreteThemePackId
  url: string
}

/** The active scenic backdrop. The still always paints first; animation is an optional layer on top. */
export default function JiangnanScene({ variant }: JiangnanSceneProps) {
  const sceneMotion = useAppearanceStore((state) => state.sceneMotion)
  const effectiveThemePack = useThemeStore((state) => state.effectiveThemePack)
  const reducedMotion = useReducedMotion()
  const animate = useSceneAnimationEnabled(variant === 'workbench' && sceneMotion && !reducedMotion)
  const pack = getThemePackMeta(effectiveThemePack)
  const { assets, ready } = useThemePackAssets(effectiveThemePack)
  const { glCanvasRef, layers, rainCanvasRef } = useSceneRuntime(
    animate,
    undefined,
    effectiveThemePack,
  )

  const targetStillUrl = variant === 'business' ? assets.businessUrl : assets.sceneUrl
  const [displayed, setDisplayed] = useState<DisplayedStill | null>(() =>
    ready ? { packId: effectiveThemePack, url: targetStillUrl } : null,
  )
  const [previousUrl, setPreviousUrl] = useState<string | null>(null)
  const displayedRef = useRef<DisplayedStill | null>(displayed)

  useEffect(() => {
    displayedRef.current = displayed
  }, [displayed])

  useEffect(() => {
    if (!ready) return

    const current = displayedRef.current
    if (current && current.packId === effectiveThemePack && current.url === targetStillUrl) return

    let cancelled = false
    let clearTimer: number | undefined
    let frameId: number | undefined

    const commitSwap = () => {
      if (cancelled) return
      const prev = displayedRef.current
      const packChanged = prev !== null && prev.packId !== effectiveThemePack
      const next: DisplayedStill = { packId: effectiveThemePack, url: targetStillUrl }
      if (packChanged && !reducedMotion) {
        setPreviousUrl(prev.url)
        setDisplayed(next)
        clearTimer = window.setTimeout(() => {
          if (!cancelled) setPreviousUrl(null)
        }, CROSSFADE_MS)
      } else {
        setPreviousUrl(null)
        setDisplayed(next)
      }
    }

    const scheduleSwap = () => {
      if (typeof window.requestAnimationFrame === 'function') {
        frameId = window.requestAnimationFrame(commitSwap)
      } else {
        clearTimer = window.setTimeout(commitSwap, 0)
      }
    }

    const packChanged = current !== null && current.packId !== effectiveThemePack
    if (
      !packChanged ||
      reducedMotion ||
      typeof window === 'undefined' ||
      typeof window.Image !== 'function'
    ) {
      scheduleSwap()
    } else {
      const preload = new window.Image()
      preload.src = targetStillUrl
      if (typeof preload.decode === 'function') {
        void preload.decode().then(scheduleSwap, scheduleSwap)
      } else if (preload.complete) {
        scheduleSwap()
      } else {
        preload.onload = scheduleSwap
        preload.onerror = scheduleSwap
      }
    }

    return () => {
      cancelled = true
      if (frameId !== undefined) window.cancelAnimationFrame(frameId)
      if (clearTimer !== undefined) window.clearTimeout(clearTimer)
    }
  }, [effectiveThemePack, ready, reducedMotion, targetStillUrl])

  const activeUrl = reducedMotion
    ? ready
      ? targetStillUrl
      : null
    : (displayed?.url ?? (ready ? targetStillUrl : null))
  const activePreviousUrl = reducedMotion ? null : previousUrl

  const sceneStyle = activeUrl
    ? ({
        '--ods-scene-business-url': `url("${activeUrl}")`,
        '--ods-scene-still-url': `url("${activeUrl}")`,
      } as CSSProperties)
    : undefined

  return (
    <div
      aria-hidden="true"
      className="jiangnan-scene"
      data-theme-pack={effectiveThemePack}
      data-variant={variant}
      style={sceneStyle}
    >
      {activePreviousUrl ? (
        <div
          className="jiangnan-scene__still jiangnan-scene__still--previous"
          style={
            {
              '--ods-scene-business-url': `url("${activePreviousUrl}")`,
              '--ods-scene-still-url': `url("${activePreviousUrl}")`,
            } as CSSProperties
          }
        />
      ) : null}
      <div
        className={
          activePreviousUrl
            ? 'jiangnan-scene__still jiangnan-scene__still--entering'
            : 'jiangnan-scene__still'
        }
        data-loading={!activeUrl || undefined}
        key={activeUrl ?? 'loading'}
      />
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
      {variant === 'workbench' && pack.hasGreeter ? (
        <SceneGreeter crop="cover" waving={animate} />
      ) : null}
      <div className="jiangnan-scene__veil" />
    </div>
  )
}
