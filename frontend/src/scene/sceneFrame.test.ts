import { describe, expect, it } from 'vitest'
import {
  getRenderScale,
  getSceneCrop,
  SCENE_ASPECT,
  SCENE_FOCUS,
  SCENE_QUALITY,
} from './sceneFrame'

describe('getSceneCrop', () => {
  it('shows the whole still when the window has the same proportions', () => {
    expect(getSceneCrop(1487, 1058)).toEqual({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 })
  })

  it('crops top and bottom around the focal point in a wider window', () => {
    const crop = getSceneCrop(1280, 800)

    expect(crop.scaleX).toBe(1)
    expect(crop.offsetX).toBe(0)
    expect(crop.scaleY).toBeCloseTo(SCENE_ASPECT / (1280 / 800), 6)
    expect(crop.offsetY).toBeCloseTo((1 - crop.scaleY) * SCENE_FOCUS.y, 6)
  })

  it('crops left and right around the focal point in a taller window', () => {
    const crop = getSceneCrop(800, 1000)

    expect(crop.scaleY).toBe(1)
    expect(crop.offsetY).toBe(0)
    expect(crop.scaleX).toBeCloseTo(0.8 / SCENE_ASPECT, 6)
    expect(crop.offsetX).toBeCloseTo((1 - crop.scaleX) * SCENE_FOCUS.x, 6)
  })

  it('does not divide by zero for a collapsed window', () => {
    const crop = getSceneCrop(1280, 0)

    expect(Number.isFinite(crop.scaleY)).toBe(true)
    expect(Number.isFinite(crop.offsetY)).toBe(true)
  })
})

describe('getRenderScale', () => {
  it('renders at the device pixel ratio when it fits the profile', () => {
    expect(getRenderScale(1000, 800, 1, SCENE_QUALITY.standard)).toBe(1)
  })

  it('caps the pixel ratio at the profile limit', () => {
    expect(getRenderScale(800, 600, 3, SCENE_QUALITY.standard)).toBe(1.5)
    expect(getRenderScale(800, 600, 2, SCENE_QUALITY.low)).toBe(1)
  })

  it('shrinks the backing store to stay inside the pixel budget', () => {
    const scale = getRenderScale(2560, 1440, 2, SCENE_QUALITY.standard)

    expect(scale).toBeLessThan(1.5)
    expect(2560 * 1440 * scale * scale).toBeCloseTo(SCENE_QUALITY.standard.maxPixels, 0)
  })

  it('treats a missing pixel ratio as 1', () => {
    expect(getRenderScale(800, 600, 0, SCENE_QUALITY.standard)).toBe(1)
  })

  it('keeps the low profile cheaper than the standard one', () => {
    expect(SCENE_QUALITY.low.maxPixels).toBeLessThan(SCENE_QUALITY.standard.maxPixels)
    expect(SCENE_QUALITY.low.rainCount).toBeLessThan(SCENE_QUALITY.standard.rainCount)
    expect(SCENE_QUALITY.low.rippleCount).toBeLessThan(SCENE_QUALITY.standard.rippleCount)
  })
})
