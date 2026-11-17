import { SCENE_WATERLINE, type SceneCrop } from './sceneFrame'

interface Streak {
  alpha: number
  length: number
  speed: number
  x: number
  y: number
}

interface Ripple {
  age: number
  life: number
  scale: number
  x: number
  y: number
}

export interface RainRenderer {
  render: (deltaSeconds: number) => void
  resize: (width: number, height: number, scale: number, crop: SceneCrop) => void
  setDensity: (streaks: number, ripples: number) => void
}

// The streaks painted into the still lean 13.5 degrees and fall towards the lower left.
const SLANT = Math.tan((13.5 * Math.PI) / 180)

/** Draws rain streaks and the rings they leave on the water. Pools are allocated once. */
export function createRainRenderer(canvas: HTMLCanvasElement): RainRenderer {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')

  let width = 0
  let height = 0
  let scale = 1
  let waterTop = { left: 0, right: 0 }
  let streaks: Streak[] = []
  let ripples: Ripple[] = []

  const waterlineAt = (x: number) =>
    waterTop.left + (waterTop.right - waterTop.left) * (x / Math.max(1, width))

  const resetStreak = (streak: Streak, anywhere: boolean) => {
    streak.x = Math.random() * (width + height * SLANT)
    streak.y = anywhere ? Math.random() * height : -40 - Math.random() * 120
    // Mostly short with a few long ones: median near 32px, longest 100px.
    streak.length = 22 + Math.random() ** 3 * 78
    streak.speed = 620 + Math.random() * 520
    streak.alpha = 0.08 + Math.random() * 0.14
  }

  const resetRipple = (ripple: Ripple, started: boolean) => {
    ripple.x = Math.random() * width
    const top = waterlineAt(ripple.x) + 24
    const depth = Math.random()
    ripple.y = top + depth * Math.max(0, height - top - 12)
    ripple.scale = 0.45 + depth * 0.9
    ripple.life = 0.8 + Math.random()
    ripple.age = started ? Math.random() * ripple.life : -Math.random() * 1.6
  }

  return {
    render(deltaSeconds) {
      context.setTransform(scale, 0, 0, scale, 0, 0)
      context.clearRect(0, 0, width, height)

      context.lineCap = 'round'
      context.lineWidth = 1.5
      for (const streak of streaks) {
        streak.y += streak.speed * deltaSeconds
        streak.x -= streak.speed * SLANT * deltaSeconds
        if (streak.y - streak.length > height) resetStreak(streak, false)
        context.strokeStyle = `rgba(255, 255, 255, ${streak.alpha})`
        context.beginPath()
        context.moveTo(streak.x, streak.y)
        context.lineTo(streak.x + streak.length * SLANT, streak.y - streak.length)
        context.stroke()
      }

      context.lineWidth = 1
      for (const ripple of ripples) {
        ripple.age += deltaSeconds
        if (ripple.age > ripple.life) resetRipple(ripple, false)
        if (ripple.age < 0) continue
        const progress = ripple.age / ripple.life
        const radius = (4 + progress * 24) * ripple.scale
        context.strokeStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.42})`
        context.beginPath()
        context.ellipse(ripple.x, ripple.y, radius, radius * 0.3, 0, 0, Math.PI * 2)
        context.stroke()
      }
    },
    resize(nextWidth, nextHeight, nextScale, crop) {
      width = nextWidth
      height = nextHeight
      scale = nextScale
      canvas.width = Math.round(nextWidth * nextScale)
      canvas.height = Math.round(nextHeight * nextScale)
      const toScreen = (line: number) => ((line - crop.offsetY) / crop.scaleY) * nextHeight
      waterTop = {
        left: toScreen(SCENE_WATERLINE.left),
        right: toScreen(SCENE_WATERLINE.right),
      }
      streaks.forEach((streak) => resetStreak(streak, true))
      ripples.forEach((ripple) => resetRipple(ripple, true))
    },
    setDensity(streakCount, rippleCount) {
      streaks = Array.from({ length: streakCount }, () => {
        const streak = { alpha: 0, length: 0, speed: 0, x: 0, y: 0 }
        resetStreak(streak, true)
        return streak
      })
      ripples = Array.from({ length: rippleCount }, () => {
        const ripple = { age: 0, life: 1, scale: 1, x: 0, y: 0 }
        resetRipple(ripple, true)
        return ripple
      })
    },
  }
}
