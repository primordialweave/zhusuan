import { describe, expect, it, vi } from 'vitest'
import { createAtmosphereRenderer, type SceneParticlePreset } from './renderAtmosphere2D'

const createMockContext2D = () => {
  const gradient = { addColorStop: vi.fn() }
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    lineCap: 'butt',
    lineTo: vi.fn(),
    lineWidth: 1,
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    translate: vi.fn(),
  }
}

describe('renderAtmosphere2D', () => {
  const presets: ReadonlyArray<SceneParticlePreset> = [
    'rain',
    'firefly',
    'leaves',
    'snow',
    'lantern',
    'osmanthus',
  ]

  it.each(presets)(
    'renders %s cleanly across standard and low density without non-standard Canvas2D APIs',
    (preset) => {
      const ctx = createMockContext2D()
      const canvas = {
        getContext: vi.fn(() => ctx),
        height: 0,
        width: 0,
      } as unknown as HTMLCanvasElement

      const renderer = createAtmosphereRenderer(canvas, preset)
      renderer.setDensity(110, 14)
      renderer.resize(1280, 800, 1.5, { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 })
      expect(canvas.width).toBe(1920)
      expect(canvas.height).toBe(1200)

      for (let i = 0; i < 6; i += 1) {
        renderer.render(1 / 60)
      }
      expect(ctx.clearRect).toHaveBeenCalled()

      // Stepping down to low quality also works cleanly.
      renderer.setDensity(45, 6)
      renderer.render(1 / 30)
    },
  )
})
