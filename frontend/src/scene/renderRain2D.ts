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

interface Swallow {
  /** Seconds until the next pass while idle, then seconds into the pass. */
  clock: number
  direction: 1 | -1
  duration: number
  flying: boolean
  height: number
  size: number
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

  const swallow: Swallow = {
    clock: 3,
    direction: 1,
    duration: 7,
    flying: false,
    height: 0.14,
    size: 1,
  }

  // A swallow crosses the open sky now and then: a shallow dipping glide with quick wingbeats.
  const drawSwallow = (deltaSeconds: number) => {
    swallow.clock += swallow.flying ? deltaSeconds : -deltaSeconds
    if (!swallow.flying) {
      if (swallow.clock > 0) return
      swallow.flying = true
      swallow.clock = 0
      swallow.direction = Math.random() < 0.5 ? 1 : -1
      swallow.duration = 6 + Math.random() * 3
      swallow.height = 0.07 + Math.random() * 0.12
      swallow.size = 0.85 + Math.random() * 0.4
    }
    const progress = swallow.clock / swallow.duration
    if (progress >= 1) {
      swallow.flying = false
      swallow.clock = 9 + Math.random() * 10
      return
    }
    const travel = width + 120
    const along = swallow.direction === 1 ? progress : 1 - progress
    const x = along * travel - 60
    const y = height * (swallow.height + Math.sin(progress * Math.PI * 2.2) * 0.022)
    const flap = Math.sin(swallow.clock * 15)
    const span = 13 * swallow.size
    const lift = (2 + flap * 6) * swallow.size
    const fade = Math.min(1, progress * 8, (1 - progress) * 8)

    context.save()
    context.translate(x, y)
    context.scale(swallow.direction, 1)
    context.fillStyle = `rgba(34, 52, 44, ${0.62 * fade})`
    context.beginPath()
    // Wings sweep back from the shoulders; the forked tail trails behind.
    context.moveTo(5 * swallow.size, 0)
    context.quadraticCurveTo(0, -lift * 0.6, -span * 0.55, -lift - 4 * swallow.size)
    context.quadraticCurveTo(-span * 0.2, -lift * 0.2, -3 * swallow.size, 0.5)
    context.lineTo(-span * 0.95, -2.5 * swallow.size)
    context.lineTo(-span * 0.6, 0.8 * swallow.size)
    context.lineTo(-span * 0.95, 3.5 * swallow.size)
    context.quadraticCurveTo(-span * 0.2, 2.2 * swallow.size, -3 * swallow.size, 1.5)
    context.quadraticCurveTo(-span * 0.25, lift * 0.5 + 3, -span * 0.5, lift + 5 * swallow.size)
    context.quadraticCurveTo(0, lift * 0.5 + 1, 5 * swallow.size, 0)
    context.fill()
    context.restore()
  }

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
    ripple.life = 1.1 + Math.random() * 1.2
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
        // Two rings per drop: the second starts later and stays inside the first.
        for (const lag of [0, 0.28]) {
          const ring = (progress - lag) / (1 - lag)
          if (ring <= 0) continue
          const radius = (4 + ring * 30) * ripple.scale
          context.strokeStyle = `rgba(255, 255, 255, ${(1 - ring) * (lag === 0 ? 0.5 : 0.3)})`
          context.beginPath()
          context.ellipse(ripple.x, ripple.y, radius, radius * 0.3, 0, 0, Math.PI * 2)
          context.stroke()
        }
      }

      drawSwallow(deltaSeconds)
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
