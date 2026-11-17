/** Shared geometry for the 烟雨江南 scene: the still, the WebGL layer and the rain all crop alike. */

/** Source still size; only its aspect ratio matters. */
export const SCENE_ASPECT = 1487 / 1058

/** Focal point kept in view when the window is wider or taller than the still (0–1). */
export const SCENE_FOCUS = { x: 0.5, y: 0.45 } as const

/** Where water starts in the still, as a fraction of its height, left edge to right edge. */
export const SCENE_WATERLINE = { left: 0.635, right: 0.585 } as const

export interface SceneCrop {
  /** Portion of the still that is visible (0–1 on each axis). */
  scaleX: number
  scaleY: number
  /** Top-left of the visible portion in still coordinates (0–1). */
  offsetX: number
  offsetY: number
}

/** Mirrors CSS `background-size: cover` with `background-position: SCENE_FOCUS`. */
export function getSceneCrop(width: number, height: number): SceneCrop {
  const viewAspect = width / Math.max(1, height)
  const scaleX = viewAspect < SCENE_ASPECT ? viewAspect / SCENE_ASPECT : 1
  const scaleY = viewAspect > SCENE_ASPECT ? SCENE_ASPECT / viewAspect : 1
  return {
    offsetX: (1 - scaleX) * SCENE_FOCUS.x,
    offsetY: (1 - scaleY) * SCENE_FOCUS.y,
    scaleX,
    scaleY,
  }
}

export type SceneQuality = 'standard' | 'low'

export interface SceneQualityProfile {
  maxPixelRatio: number
  maxPixels: number
  rainCount: number
  rippleCount: number
}

export const SCENE_QUALITY: Record<SceneQuality, SceneQualityProfile> = {
  low: { maxPixelRatio: 1, maxPixels: 1_400_000, rainCount: 48, rippleCount: 3 },
  standard: { maxPixelRatio: 1.5, maxPixels: 2_400_000, rainCount: 96, rippleCount: 6 },
}

/** Backing-store scale for a canvas of the given CSS size under a quality profile. */
export function getRenderScale(
  width: number,
  height: number,
  devicePixelRatio: number,
  profile: SceneQualityProfile,
) {
  const ratio = Math.min(devicePixelRatio || 1, profile.maxPixelRatio)
  const pixels = width * height * ratio * ratio
  return pixels > profile.maxPixels ? ratio * Math.sqrt(profile.maxPixels / pixels) : ratio
}
