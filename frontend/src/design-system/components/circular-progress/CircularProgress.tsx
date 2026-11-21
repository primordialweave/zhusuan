import { forwardRef, useId, type HTMLAttributes } from 'react'

export type CircularProgressSize = 'sm' | 'md' | 'lg'
export type CircularProgressTone = 'accent' | 'success' | 'warning' | 'danger'

export interface CircularProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  'aria-label'?: string
  indeterminate?: boolean
  max?: number
  min?: number
  showValueLabel?: boolean
  size?: CircularProgressSize
  tone?: CircularProgressTone
  value?: number
  valueLabel?: string
}

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const clampFraction = (value: number, min: number, max: number) => {
  if (max <= min) return 0
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

export const CircularProgress = forwardRef<HTMLDivElement, CircularProgressProps>(
  function CircularProgress(
    {
      'aria-label': ariaLabel = '进度',
      className,
      indeterminate = false,
      max = 100,
      min = 0,
      showValueLabel = false,
      size = 'md',
      tone = 'accent',
      value = 0,
      valueLabel,
      ...props
    },
    ref,
  ) {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
    const fraction = clampFraction(value, min, max)
    const percent = Math.round(fraction * 100)
    const isComplete = !indeterminate && fraction >= 1
    const dashArray = isComplete ? undefined : CIRCUMFERENCE
    const dashOffset = isComplete
      ? undefined
      : indeterminate
        ? CIRCUMFERENCE * 0.7
        : CIRCUMFERENCE * (1 - fraction)
    const showArc = indeterminate || fraction > 0
    const arcGradId = `ods-cp-arc-${uid}`
    const ridgeGradId = `ods-cp-ridge-${uid}`

    return (
      <div
        {...props}
        aria-label={ariaLabel}
        aria-valuemax={indeterminate ? undefined : max}
        aria-valuemin={indeterminate ? undefined : min}
        aria-valuenow={indeterminate ? undefined : value}
        className={['ods-circular-progress', className].filter(Boolean).join(' ')}
        data-indeterminate={indeterminate || undefined}
        data-size={size}
        data-slot="circular-progress"
        data-tone={tone}
        ref={ref}
        role="progressbar"
      >
        <svg className="ods-circular-progress__svg" data-slot="svg" viewBox="0 0 100 100">
          <defs>
            {/* Note: svg is rotated -90deg, so visual upper-left maps to SVG upper-right (x:88, y:14). */}
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id={arcGradId}
              x1="88"
              x2="12"
              y1="14"
              y2="86"
            >
              <stop className="ods-circular-progress__stop--light" offset="0%" />
              <stop className="ods-circular-progress__stop--base" offset="54%" />
              <stop className="ods-circular-progress__stop--depth" offset="100%" />
            </linearGradient>
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id={ridgeGradId}
              x1="90"
              x2="10"
              y1="14"
              y2="86"
            >
              <stop className="ods-circular-progress__stop--ridge" offset="0%" stopOpacity="0.46" />
              <stop className="ods-circular-progress__stop--ridge" offset="48%" stopOpacity="0.1" />
              <stop className="ods-circular-progress__stop--ridge" offset="100%" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <circle className="ods-circular-progress__track" cx="50" cy="50" fill="none" r={RADIUS} />
          {showArc ? (
            <>
              <circle
                className="ods-circular-progress__indicator"
                cx="50"
                cy="50"
                fill="none"
                r={RADIUS}
                stroke={`url(#${arcGradId})`}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
              {/* Soft convex jade sheen tracking strictly along the filled progress arc. */}
              <circle
                aria-hidden="true"
                className="ods-circular-progress__ridge"
                cx="50"
                cy="50"
                fill="none"
                r={RADIUS}
                stroke={`url(#${ridgeGradId})`}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            </>
          ) : null}
        </svg>
        {showValueLabel && !indeterminate ? (
          <span className="ods-circular-progress__label" data-slot="label">
            {valueLabel ?? `${percent}%`}
          </span>
        ) : null}
      </div>
    )
  },
)
