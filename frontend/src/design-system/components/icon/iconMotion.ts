/**
 * Checks both OS-level `prefers-reduced-motion` and the in-app `data-motion="reduced"` toggle.
 * CSS reduced-motion rules do not intercept JS Web Animations API calls, so every WAAPI sequence
 * must gate on this helper before animating.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true
  if (document.documentElement.dataset.motion === 'reduced') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export const SAVED_REACTION_HOLD_MS = 800
export const COPIED_REACTION_HOLD_MS = 1600
