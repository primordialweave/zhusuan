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

const activeMotion = new WeakMap<Element, Set<Animation>>()
const motionCleanup = new WeakMap<Animation, () => void>()

/** Stops a tracked animation and releases its preference listeners immediately. */
export function cancelMotionAnimation(animation: Animation | null) {
  if (!animation) return
  motionCleanup.get(animation)?.()
  animation.cancel()
}

/** Used on repeat activation and unmount, including animations on a button's child SVG. */
export function cancelMotionAnimations(target: Element | null, includeDescendants = false) {
  if (!target) return
  const targets = includeDescendants ? [target, ...target.querySelectorAll('*')] : [target]
  for (const element of targets) {
    for (const animation of [...(activeMotion.get(element) ?? [])]) {
      cancelMotionAnimation(animation)
    }
  }
}

/**
 * Preference changes must also stop an already running WAAPI effect; CSS motion rules only
 * affect CSS animations. Observation lasts for this finite animation and ends on completion.
 */
export function animateWithMotionPreference(
  target: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
): Animation | null {
  if (prefersReducedMotion() || typeof target.animate !== 'function') return null

  const animation = target.animate(keyframes, options)
  const tracked = activeMotion.get(target) ?? new Set<Animation>()
  tracked.add(animation)
  activeMotion.set(target, tracked)
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  let disposed = false

  const onPreferenceChange = () => {
    if (prefersReducedMotion()) cancelMotionAnimation(animation)
  }
  const observer = new MutationObserver(onPreferenceChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  })
  media?.addEventListener?.('change', onPreferenceChange)

  const dispose = () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
    media?.removeEventListener?.('change', onPreferenceChange)
    tracked.delete(animation)
    if (tracked.size === 0) activeMotion.delete(target)
    motionCleanup.delete(animation)
  }
  motionCleanup.set(animation, dispose)
  // Both handlers are intentional: cancelling rejects finished and must not leak a rejection.
  animation.finished?.then(dispose, dispose)
  return animation
}

export const SAVED_REACTION_HOLD_MS = 800
export const COPIED_REACTION_HOLD_MS = 1600
