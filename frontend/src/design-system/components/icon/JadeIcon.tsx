import { forwardRef, useEffect, useRef, useState, type SVGAttributes } from 'react'
import {
  animateWithMotionPreference,
  cancelMotionAnimation,
  COPIED_REACTION_HOLD_MS,
  prefersReducedMotion,
  SAVED_REACTION_HOLD_MS,
} from './iconMotion'
import { JADE_ICON_REGISTRY, type JadeGlyphDefinition, type JadeIconName } from './registry'

export type JadeIconDetail = 'subtle' | 'carved'

export type JadeIconTone =
  | 'inherit'
  | 'jade'
  | 'on-accent'
  | 'inverse'
  | 'muted'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'ink'

export type JadeIconSize = 'sm' | 'md' | 'lg' | 'xl' | 'dock' | number | string

export type JadeIconMotionPreset = 'none' | 'glint' | 'interactive'

export interface JadeIconReaction {
  eventKey: number
  kind: 'none' | 'saved' | 'copied' | 'newUnread'
}

export interface JadeIconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'name'> {
  detail?: JadeIconDetail
  label?: string
  motionPreset?: JadeIconMotionPreset
  name: JadeIconName
  reaction?: JadeIconReaction
  size?: JadeIconSize
  tone?: JadeIconTone
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg' | 'xl' | 'dock', string> = {
  sm: '16px',
  md: '18px',
  lg: '20px',
  xl: '24px',
  dock: 'var(--ods-shell-dock-icon-size)',
}

const GRADIENT_TONES: ReadonlySet<JadeIconTone> = new Set([
  'jade',
  'on-accent',
  'success',
  'warning',
  'danger',
  'info',
])

const resolveSize = (size: JadeIconSize | undefined): string => {
  if (size === undefined) return '1em'
  if (typeof size === 'number') return `${size}px`
  if (size in SIZE_MAP) return SIZE_MAP[size as keyof typeof SIZE_MAP]
  return size
}

const resolveBodyPaint = (tone: JadeIconTone): string => {
  if (GRADIENT_TONES.has(tone)) return `url(#ods-jade-icon-grad-${tone})`
  return 'currentColor'
}

export const JadeIcon = forwardRef<SVGSVGElement, JadeIconProps>(function JadeIcon(
  {
    className,
    detail = 'subtle',
    label,
    motionPreset = 'none',
    name,
    reaction,
    size,
    style,
    tone = 'inherit',
    ...props
  },
  forwardedRef,
) {
  const glyph: JadeGlyphDefinition = JADE_ICON_REGISTRY[name]
  const dimension = resolveSize(size)
  const isInk = tone === 'ink'
  const isStroke = glyph.mode === 'stroke'
  const strokeWidth = glyph.strokeWidth ?? 1.9
  const bodyPaint = resolveBodyPaint(tone)

  const internalSvgRef = useRef<SVGSVGElement | null>(null)
  const lastEventKeyRef = useRef<number>(0)
  const activeAnimationRef = useRef<Animation | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const [showingCheck, setShowingCheck] = useState(false)

  const reactionKind = reaction?.kind ?? 'none'
  const reactionKey = reaction?.eventKey ?? 0
  const canShowCheck = reactionKind === 'saved' || reactionKind === 'copied'
  const reactionActive = showingCheck && canShowCheck

  useEffect(() => {
    const clearPending = () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
      if (activeAnimationRef.current) {
        cancelMotionAnimation(activeAnimationRef.current)
        activeAnimationRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearPending()
        setShowingCheck(false)
      }
    }

    if (reactionKind === 'none' || reactionKey <= 0) {
      clearPending()
      lastEventKeyRef.current = 0
      setShowingCheck(false)
      return
    }
    if (reactionKey === lastEventKeyRef.current) return
    lastEventKeyRef.current = reactionKey

    clearPending()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (reactionKind === 'newUnread') {
      if (!prefersReducedMotion()) {
        const part = internalSvgRef.current?.querySelector<SVGGElement>(
          '[data-jade-part="bell-body"]',
        )
        if (part && typeof part.animate === 'function') {
          activeAnimationRef.current = animateWithMotionPreference(
            part,
            [
              { transform: 'rotate(0deg)' },
              { offset: 0.32, transform: 'rotate(-4deg)' },
              { offset: 0.68, transform: 'rotate(4deg)' },
              { transform: 'rotate(0deg)' },
            ],
            {
              duration: 200,
              easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
              iterations: 1,
            },
          )
        }
      }
    } else if (reactionKind === 'saved' || reactionKind === 'copied') {
      setShowingCheck(true)
      const holdMs = reactionKind === 'copied' ? COPIED_REACTION_HOLD_MS : SAVED_REACTION_HOLD_MS
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null
        setShowingCheck(false)
      }, holdMs)
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearPending()
    }
  }, [reactionKey, reactionKind])

  const setSvgRef = (node: SVGSVGElement | null) => {
    internalSvgRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  const paintAttrs = isStroke
    ? {
        fill: 'none',
        stroke: bodyPaint,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        strokeWidth,
      }
    : {
        fill: bodyPaint,
        stroke: 'none',
      }

  const shadowAttrs = isStroke
    ? {
        fill: 'none',
        stroke: 'var(--ods-material-jade-icon-shadow)',
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        strokeWidth,
      }
    : {
        fill: 'var(--ods-material-jade-icon-shadow)',
        stroke: 'none',
      }

  const specularAttrs = isStroke
    ? {
        fill: 'none',
        stroke: 'url(#ods-jade-icon-grad-specular)',
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        strokeWidth,
      }
    : {
        fill: 'url(#ods-jade-icon-grad-specular)',
        stroke: 'none',
      }

  const renderGeometry = (includePartHooks: boolean) => (
    <>
      {glyph.staticPart ?? null}
      {glyph.motionPart ? (
        <g
          className={includePartHooks ? 'ods-jade-icon__part' : undefined}
          data-jade-part={includePartHooks ? glyph.motionPart.id : undefined}
        >
          {glyph.motionPart.content}
        </g>
      ) : null}
    </>
  )

  return (
    <svg
      {...props}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={['ods-jade-icon', className].filter(Boolean).join(' ')}
      data-detail={detail}
      data-icon={name}
      data-motion-preset={motionPreset}
      data-reaction={reactionKind !== 'none' ? reactionKind : undefined}
      data-reaction-active={reactionActive || undefined}
      data-slot="jade-icon"
      data-tone={tone}
      focusable="false"
      height={dimension}
      ref={setSvgRef}
      role={label ? 'img' : undefined}
      style={style}
      viewBox="0 0 24 24"
      width={dimension}
    >
      <g className="ods-jade-icon__glyph-layers">
        {/* Layer 1: Static underside jade depth (not motion; preserved in reduced-motion). */}
        {!isInk ? (
          <g
            aria-hidden="true"
            className="ods-jade-icon__depth"
            transform={detail === 'carved' ? 'translate(0 1)' : 'translate(0 0.5)'}
            {...shadowAttrs}
          >
            {renderGeometry(false)}
          </g>
        ) : null}

        {/* Optional translucent inner jade wash for enclosed forms. */}
        {!isInk && glyph.tint ? (
          <g aria-hidden="true" className="ods-jade-icon__tint">
            {glyph.tint}
          </g>
        ) : null}

        {/* Layer 2: Primary rounded jade body. */}
        <g className="ods-jade-icon__body" {...paintAttrs}>
          {renderGeometry(true)}
        </g>

        {/* Layer 3: Upper-left translucent specular highlight. */}
        {!isInk ? (
          <g aria-hidden="true" className="ods-jade-icon__specular" {...specularAttrs}>
            {renderGeometry(true)}
          </g>
        ) : null}
      </g>

      {/* Reaction check overlay (saved / copied verified outcomes). */}
      {canShowCheck ? (
        <g
          aria-hidden="true"
          className="ods-jade-icon__reaction-check"
          data-active={reactionActive || undefined}
          fill="none"
          stroke={bodyPaint}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.1}
        >
          <path d="M5.25 12.5L9.75 17L18.75 7.5" />
        </g>
      ) : null}
    </svg>
  )
})
