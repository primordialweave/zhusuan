import { prefersReducedMotion } from '../icon/iconMotion'

const RIPPLE_DURATION_MS = 440
const ICON_REBOUND_DURATION_MS = 260

export function triggerButtonRipple(
  button: HTMLElement | null,
  ripple: HTMLSpanElement | null,
  clientX?: number,
  clientY?: number,
) {
  if (!button || !ripple || prefersReducedMotion()) return
  if (typeof ripple.animate !== 'function') return

  const rect = button.getBoundingClientRect()
  const width = Math.max(rect.width, 32)
  const height = Math.max(rect.height, 32)
  const diameter = Math.hypot(width, height) * 1.15
  const hasPointerCoords =
    typeof clientX === 'number' &&
    typeof clientY === 'number' &&
    rect.width > 0 &&
    rect.height > 0
  const x = hasPointerCoords ? clientX - rect.left : width / 2
  const y = hasPointerCoords ? clientY - rect.top : height / 2

  ripple.style.width = `${diameter}px`
  ripple.style.height = `${diameter}px`
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`

  for (const running of ripple.getAnimations?.() ?? []) {
    running.cancel()
  }

  ripple.animate(
    [
      { opacity: 0.72, transform: 'translate(-50%, -50%) scale(0.12)' },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1.05)' },
    ],
    {
      duration: RIPPLE_DURATION_MS,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'none',
    },
  )
}

export function triggerButtonIconPulse(button: HTMLElement | null) {
  if (!button || prefersReducedMotion()) return
  const target =
    button.querySelector<HTMLElement>('.ods-icon-button__icon') ??
    button.querySelector<SVGSVGElement>('.ods-jade-icon')
  if (!target || typeof target.animate !== 'function') return

  for (const running of target.getAnimations?.() ?? []) {
    running.cancel()
  }

  target.animate(
    [
      { transform: 'scale(0.86)' },
      { offset: 0.55, transform: 'scale(1.14)' },
      { transform: 'scale(1)' },
    ],
    {
      duration: ICON_REBOUND_DURATION_MS,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      fill: 'none',
    },
  )
}
