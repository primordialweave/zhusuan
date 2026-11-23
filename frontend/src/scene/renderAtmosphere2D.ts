import { SCENE_WATERLINE } from './sceneFrame'
import { createRainRenderer, type RainRenderer } from './renderRain2D'

export type SceneParticlePreset =
  | 'rain'
  | 'firefly'
  | 'leaves'
  | 'snow'
  | 'lantern'
  | 'osmanthus'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  phase: number
  spin: number
  angle: number
  tone: number
  /** 0 = primary hero element, 1 = secondary accent element (petal / ember / crystal / glint). */
  kind: number
  /** Depth plane 0..1 (far -> near) for parallax speed and bokeh clarity. */
  depth: number
}

interface WaterRipple {
  x: number
  y: number
  age: number
  life: number
  scale: number
}

/**
 * Unified low-CPU Canvas 2D atmospheric particle renderer supporting all seasonal and holiday themes.
 * Uses fixed pre-allocated particle pools with zero per-frame allocations.
 */
export function createAtmosphereRenderer(
  canvas: HTMLCanvasElement,
  preset: SceneParticlePreset,
): RainRenderer {
  if (preset === 'rain') {
    return createRainRenderer(canvas)
  }

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')

  let width = 0
  let height = 0
  let scale = 1
  let elapsed = 0
  let waterTop = { left: 0, right: 0 }
  let particles: Particle[] = []
  let ripples: WaterRipple[] = []

  const waterlineAt = (x: number) =>
    waterTop.left + (waterTop.right - waterTop.left) * (x / Math.max(1, width))

  const resetParticle = (p: Particle, scattered: boolean) => {
    p.phase = Math.random() * Math.PI * 2
    p.tone = Math.random()
    p.angle = Math.random() * Math.PI * 2
    p.depth = Math.random()

    if (preset === 'firefly') {
      // 75% glowing summer fireflies, 25% drifting pale-pink lotus petals
      p.kind = p.tone < 0.75 ? 0 : 1
      if (p.kind === 0) {
        p.x = Math.random() * Math.max(1, width)
        const top = Math.max(height * 0.3, waterlineAt(p.x) - height * 0.25)
        p.y = top + Math.random() * Math.max(40, height - top - 36)
        p.vx = (Math.random() - 0.5) * 14
        p.vy = (Math.random() - 0.5) * 8
        p.size = 1.6 + p.depth * 2.2
        p.alpha = 0.28 + p.depth * 0.48
        p.spin = 0.9 + Math.random() * 1.4
      } else {
        p.x = scattered ? Math.random() * Math.max(1, width) : width * (0.35 + Math.random() * 0.75)
        p.y = scattered ? Math.random() * Math.max(1, height * 0.82) : -14 - Math.random() * 60
        p.vx = -12 - Math.random() * 14
        p.vy = 14 + Math.random() * 14
        p.size = 3.2 + p.depth * 2.4
        p.alpha = 0.38 + p.depth * 0.34
        p.spin = (Math.random() - 0.5) * 1.8
      }
    } else if (preset === 'leaves') {
      // 72% golden gongbi ginkgo leaves, 28% warm autumn sunlit dust motes
      p.kind = p.tone < 0.72 ? 0 : 1
      if (p.kind === 0) {
        p.x = scattered ? Math.random() * Math.max(1, width) : width * (0.22 + Math.random() * 0.92)
        p.y = scattered ? Math.random() * Math.max(1, height) : -26 - Math.random() * 90
        const speed = 0.7 + p.depth * 0.65
        p.vx = (-18 - Math.random() * 24) * speed
        p.vy = (22 + Math.random() * 22) * speed
        p.size = 5.2 + p.depth * 5.8
        p.alpha = 0.42 + p.depth * 0.42
        p.spin = (Math.random() - 0.5) * 2.0
      } else {
        p.x = Math.random() * Math.max(1, width)
        p.y = Math.random() * Math.max(1, height * 0.75)
        p.vx = -6 - Math.random() * 8
        p.vy = 4 + Math.random() * 6
        p.size = 1.1 + p.depth * 1.6
        p.alpha = 0.18 + p.depth * 0.28
        p.spin = 0.8 + Math.random() * 1.1
      }
    } else if (preset === 'snow') {
      // 3-depth rime snowfall: 84% soft snow/ice grains, 16% crystalline 6-point foreground rime stars
      p.kind = p.depth > 0.84 ? 1 : 0
      p.x = Math.random() * Math.max(1, width)
      p.y = scattered ? Math.random() * Math.max(1, height) : -14 - Math.random() * 70
      const speed = 0.52 + p.depth * 0.92
      p.vx = (-7 + Math.random() * 14) * speed
      p.vy = (14 + Math.random() * 24) * speed
      p.size = p.kind === 1 ? 3.2 + p.depth * 2.4 : 1.1 + p.depth * 2.4
      p.alpha = p.kind === 1 ? 0.34 + Math.random() * 0.28 : 0.26 + p.depth * 0.5
      p.spin = 0.5 + Math.random() * 1.0
    } else if (preset === 'lantern') {
      // 58% distant rising Kongming sky lanterns, 42% tiny rising warm candle embers
      p.kind = p.tone < 0.58 ? 0 : 1
      if (p.kind === 0) {
        p.x = width * (0.08 + Math.random() * 0.84)
        p.y = scattered
          ? height * (0.06 + Math.random() * 0.56)
          : height * (0.56 + Math.random() * 0.14)
        const speed = 0.65 + p.depth * 0.7
        p.vx = (-3.5 + Math.random() * 7) * speed
        p.vy = (-9 - Math.random() * 13) * speed
        p.size = 4.2 + p.depth * 6.2
        p.alpha = 0.42 + p.depth * 0.42
        p.spin = 0.6 + Math.random() * 0.8
      } else {
        p.x = width * (0.05 + Math.random() * 0.9)
        p.y = scattered
          ? height * (0.12 + Math.random() * 0.72)
          : height * (0.62 + Math.random() * 0.24)
        p.vx = -5 + Math.random() * 10
        p.vy = -14 - Math.random() * 20
        p.size = 1.0 + p.depth * 1.4
        p.alpha = 0.26 + p.depth * 0.42
        p.spin = 1.5 + Math.random() * 1.8
      }
    } else {
      // osmanthus: 72% 4-petal golden osmanthus florets, 28% liquid silver-gold moonlight glints on water
      p.kind = p.tone < 0.72 ? 0 : 1
      if (p.kind === 0) {
        p.x = scattered ? Math.random() * Math.max(1, width) : width * (0.24 + Math.random() * 0.88)
        p.y = scattered ? Math.random() * Math.max(1, height) : -16 - Math.random() * 70
        const speed = 0.68 + p.depth * 0.6
        p.vx = (-14 - Math.random() * 16) * speed
        p.vy = (16 + Math.random() * 18) * speed
        p.size = 2.0 + p.depth * 2.1
        p.alpha = 0.4 + p.depth * 0.4
        p.spin = (Math.random() - 0.5) * 2.6
      } else {
        p.x = width * (0.1 + Math.random() * 0.8)
        const top = waterlineAt(p.x) + 14
        p.y = top + Math.random() * Math.max(30, height - top - 16)
        p.vx = 0
        p.vy = 0
        p.size = 6 + p.depth * 14
        p.alpha = 0.22 + p.depth * 0.34
        p.spin = 0.8 + Math.random() * 1.2
      }
    }
  }

  const resetRipple = (r: WaterRipple, started: boolean) => {
    r.x = Math.random() * Math.max(1, width)
    const top = waterlineAt(r.x) + 26
    const depth = Math.random()
    r.y = top + depth * Math.max(0, height - top - 16)
    r.scale = 0.42 + depth * 0.72
    r.life = 1.9 + Math.random() * 1.7
    r.age = started ? Math.random() * r.life : -Math.random() * 2.2
  }

  const particleCapFor = (streakCount: number) => {
    const low = streakCount <= 50
    switch (preset) {
      case 'firefly':
        return low ? 14 : 26
      case 'leaves':
        return low ? 12 : 22
      case 'snow':
        return low ? 34 : 64
      case 'lantern':
        return low ? 11 : 18
      case 'osmanthus':
        return low ? 18 : 30
      default:
        return 16
    }
  }

  const rippleCapFor = (rippleCount: number) => {
    if (preset === 'snow') return 0
    return Math.max(0, Math.round(rippleCount * 0.48))
  }

  const drawRipples = (deltaSeconds: number) => {
    if (ripples.length === 0) return
    context.lineWidth = 0.9
    const tint =
      preset === 'lantern'
        ? '255, 224, 172'
        : preset === 'osmanthus'
          ? '246, 240, 212'
          : preset === 'leaves'
            ? '244, 226, 186'
            : '255, 255, 255'
    for (const r of ripples) {
      r.age += deltaSeconds
      if (r.age > r.life) resetRipple(r, false)
      if (r.age < 0) continue
      const progress = r.age / r.life
      const radius = (4 + progress * 25) * r.scale
      const alpha = (1 - progress) * (1 - progress) * 0.3
      context.strokeStyle = `rgba(${tint}, ${alpha})`
      context.beginPath()
      context.ellipse(r.x, r.y, radius, radius * 0.27, 0, 0, Math.PI * 2)
      context.stroke()
      if (progress > 0.25) {
        const innerR = (2 + (progress - 0.25) * 18) * r.scale
        context.strokeStyle = `rgba(${tint}, ${alpha * 0.45})`
        context.beginPath()
        context.ellipse(r.x, r.y, innerR, innerR * 0.27, 0, 0, Math.PI * 2)
        context.stroke()
      }
    }
  }

  const drawSnowCrystal = (x: number, y: number, r: number, angle: number, alpha: number) => {
    context.save()
    context.translate(x, y)
    context.rotate(angle)
    context.strokeStyle = `rgba(246, 252, 255, ${alpha})`
    context.lineWidth = 0.85
    context.lineCap = 'round'
    for (let i = 0; i < 3; i += 1) {
      const a = (i * Math.PI) / 3
      const dx = Math.cos(a) * r
      const dy = Math.sin(a) * r
      context.beginPath()
      context.moveTo(-dx, -dy)
      context.lineTo(dx, dy)
      context.stroke()
    }
    context.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`
    context.beginPath()
    context.arc(0, 0, r * 0.26, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  return {
    render(deltaSeconds) {
      elapsed += deltaSeconds
      context.setTransform(scale, 0, 0, scale, 0, 0)
      context.clearRect(0, 0, width, height)

      drawRipples(deltaSeconds)

      for (const p of particles) {
        if (preset === 'firefly') {
          if (p.kind === 0) {
            const dx = p.vx + Math.sin(elapsed * 0.72 + p.phase) * 11
            const dy = p.vy + Math.cos(elapsed * 0.94 + p.phase) * 7.5
            p.x += dx * deltaSeconds
            p.y += dy * deltaSeconds
            if (p.x < -20 || p.x > width + 20 || p.y < height * 0.14 || p.y > height + 20) {
              resetParticle(p, true)
            }
            const pulse = 0.28 + 0.72 * Math.sin(elapsed * p.spin + p.phase) ** 2
            const a = p.alpha * pulse
            // Subtle trailing afterglow behind movement vector
            context.fillStyle = `rgba(218, 245, 188, ${a * 0.24})`
            context.beginPath()
            context.arc(p.x - dx * 0.08, p.y - dy * 0.08, p.size * 1.4, 0, Math.PI * 2)
            context.fill()

            const glow = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.8)
            glow.addColorStop(0, `rgba(252, 255, 212, ${a})`)
            glow.addColorStop(0.38, `rgba(182, 236, 188, ${a * 0.52})`)
            glow.addColorStop(1, 'rgba(182, 236, 188, 0)')
            context.fillStyle = glow
            context.beginPath()
            context.arc(p.x, p.y, p.size * 3.8, 0, Math.PI * 2)
            context.fill()
          } else {
            // Drifting pale-pink lotus petal
            p.x += (p.vx + Math.sin(elapsed * 1.0 + p.phase) * 10) * deltaSeconds
            p.y += p.vy * deltaSeconds
            p.angle += p.spin * deltaSeconds
            if (p.y > height + 18 || p.x < -20) resetParticle(p, false)

            const flutter = 0.58 + 0.42 * Math.cos(elapsed * 1.8 + p.phase)
            context.save()
            context.translate(p.x, p.y)
            context.rotate(p.angle)
            context.scale(1, flutter)
            context.fillStyle = `rgba(242, 198, 202, ${p.alpha})`
            context.beginPath()
            context.moveTo(0, -p.size)
            context.quadraticCurveTo(p.size * 0.78, 0, 0, p.size)
            context.quadraticCurveTo(-p.size * 0.78, 0, 0, -p.size)
            context.fill()
            context.restore()
          }
        } else if (preset === 'leaves') {
          if (p.kind === 0) {
            p.x += (p.vx + Math.sin(elapsed * 1.05 + p.phase) * 16) * deltaSeconds
            p.y += (p.vy + Math.cos(elapsed * 0.8 + p.phase) * 4) * deltaSeconds
            p.angle += p.spin * deltaSeconds
            if (p.y > height + 26 || p.x < -32) resetParticle(p, false)

            const flip = Math.cos(elapsed * 2.0 + p.phase)
            const flutter = 0.42 + 0.58 * Math.abs(flip)
            context.save()
            context.translate(p.x, p.y)
            context.rotate(p.angle)
            context.scale(1, flutter)
            // Warm sunlit gold when face-up, richer ochre-amber when face-down
            context.fillStyle =
              flip >= 0
                ? p.tone > 0.3
                  ? `rgba(226, 178, 76, ${p.alpha})`
                  : `rgba(212, 152, 62, ${p.alpha})`
                : `rgba(182, 118, 48, ${p.alpha * 0.92})`
            // Gongbi bilobed ginkgo fan silhouette + slender petiole stem
            context.beginPath()
            context.moveTo(0, p.size * 0.65)
            context.quadraticCurveTo(-p.size * 1.02, -p.size * 0.12, -p.size * 0.34, -p.size * 0.86)
            context.quadraticCurveTo(-p.size * 0.1, -p.size * 0.92, 0, -p.size * 0.46)
            context.quadraticCurveTo(p.size * 0.1, -p.size * 0.92, p.size * 0.34, -p.size * 0.86)
            context.quadraticCurveTo(p.size * 1.02, -p.size * 0.12, 0, p.size * 0.65)
            context.fill()
            context.strokeStyle = `rgba(148, 92, 34, ${p.alpha * 0.52})`
            context.lineWidth = 0.8
            context.beginPath()
            context.moveTo(0, p.size * 0.65)
            context.lineTo(0, p.size * 1.1)
            context.stroke()
            context.restore()
          } else {
            // Sunlit autumn dust mote
            p.x += (p.vx + Math.sin(elapsed * 0.6 + p.phase) * 5) * deltaSeconds
            p.y += (p.vy + Math.cos(elapsed * 0.5 + p.phase) * 4) * deltaSeconds
            if (p.x < -10) p.x = width + 8
            if (p.y > height * 0.82) p.y = 10
            const twinkle = 0.45 + 0.55 * Math.sin(elapsed * p.spin + p.phase) ** 2
            context.fillStyle = `rgba(248, 224, 156, ${p.alpha * twinkle})`
            context.beginPath()
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            context.fill()
          }
        } else if (preset === 'snow') {
          const eddy = Math.sin(elapsed * p.spin + p.phase + p.y * 0.008) * (10 + p.depth * 10)
          p.x += (p.vx + eddy) * deltaSeconds
          p.y += p.vy * deltaSeconds
          p.angle += p.spin * 0.45 * deltaSeconds
          if (p.y > height + 18) resetParticle(p, false)
          if (p.x < -18) p.x = width + 14
          if (p.x > width + 18) p.x = -14

          if (p.kind === 1) {
            // Delicate 6-point crystalline rime flake glinting softly in foreground
            const glint = 0.65 + 0.35 * Math.sin(elapsed * 2.2 + p.phase) ** 2
            drawSnowCrystal(p.x, p.y, p.size, p.angle, p.alpha * glint)
          } else if (p.depth > 0.52) {
            // Soft feathered mid-plane snowflake
            const soft = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.65)
            soft.addColorStop(0, `rgba(248, 253, 255, ${p.alpha})`)
            soft.addColorStop(0.6, `rgba(222, 238, 248, ${p.alpha * 0.48})`)
            soft.addColorStop(1, 'rgba(222, 238, 248, 0)')
            context.fillStyle = soft
            context.beginPath()
            context.arc(p.x, p.y, p.size * 1.65, 0, Math.PI * 2)
            context.fill()
          } else {
            // Crisp distant ice-mist snow grain
            context.fillStyle = `rgba(238, 247, 254, ${p.alpha})`
            context.beginPath()
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            context.fill()
          }
        } else if (preset === 'lantern') {
          if (p.kind === 0) {
            p.x += (p.vx + Math.sin(elapsed * p.spin + p.phase) * 7) * deltaSeconds
            p.y += p.vy * deltaSeconds
            if (p.y < -34) resetParticle(p, false)

            const fadeTop = Math.min(1, Math.max(0, (p.y + 24) / (height * 0.24)))
            const fadeBottom = Math.min(1, Math.max(0, (height * 0.72 - p.y) / (height * 0.12)))
            const flicker = 0.84 + 0.16 * Math.sin(elapsed * 3.1 + p.phase)
            const a = p.alpha * fadeTop * fadeBottom * flicker

            const halo = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.4)
            halo.addColorStop(0, `rgba(255, 228, 158, ${a * 0.85})`)
            halo.addColorStop(0.42, `rgba(228, 128, 72, ${a * 0.34})`)
            halo.addColorStop(1, 'rgba(228, 128, 72, 0)')
            context.fillStyle = halo
            context.beginPath()
            context.arc(p.x, p.y, p.size * 3.4, 0, Math.PI * 2)
            context.fill()

            // Classical tapered Kongming sky lantern dome + warm candle core
            const rx = p.size * 0.56
            const ry = p.size * 0.78
            const tilt = Math.sin(elapsed * 0.9 + p.phase) * 0.08
            context.save()
            context.translate(p.x, p.y)
            context.rotate(tilt)
            const body = context.createLinearGradient(0, -ry, 0, ry)
            body.addColorStop(0, `rgba(198, 86, 66, ${a * 0.88})`)
            body.addColorStop(0.55, `rgba(244, 174, 96, ${a * 0.95})`)
            body.addColorStop(1, `rgba(255, 242, 194, ${a})`)
            context.fillStyle = body
            context.beginPath()
            context.moveTo(-rx * 0.62, ry * 0.86)
            context.quadraticCurveTo(-rx * 1.05, -ry * 0.18, 0, -ry)
            context.quadraticCurveTo(rx * 1.05, -ry * 0.18, rx * 0.62, ry * 0.86)
            context.closePath()
            context.fill()
            // Bright flame spark at lantern opening
            context.fillStyle = `rgba(255, 250, 224, ${a})`
            context.beginPath()
            context.arc(0, ry * 0.68, Math.max(0.8, p.size * 0.16), 0, Math.PI * 2)
            context.fill()
            context.restore()
          } else {
            // Tiny rising golden spark ember
            p.x += (p.vx + Math.sin(elapsed * 1.8 + p.phase) * 8) * deltaSeconds
            p.y += p.vy * deltaSeconds
            if (p.y < height * 0.08) resetParticle(p, false)
            const twinkle = 0.45 + 0.55 * Math.sin(elapsed * p.spin + p.phase) ** 2
            context.fillStyle = `rgba(255, 226, 154, ${p.alpha * twinkle})`
            context.beginPath()
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            context.fill()
          }
        } else {
          // osmanthus
          if (p.kind === 0) {
            p.x += (p.vx + Math.sin(elapsed * 1.15 + p.phase) * 12) * deltaSeconds
            p.y += p.vy * deltaSeconds
            p.angle += p.spin * deltaSeconds
            if (p.y > height + 16 || p.x < -20) resetParticle(p, false)

            // Delicate 4-petal golden osmanthus floret (金桂四瓣)
            context.save()
            context.translate(p.x, p.y)
            context.rotate(p.angle)
            context.fillStyle = `rgba(238, 202, 108, ${p.alpha})`
            const pr = p.size * 0.62
            for (let i = 0; i < 4; i += 1) {
              const a = (i * Math.PI) / 2
              context.beginPath()
              context.ellipse(
                Math.cos(a) * pr,
                Math.sin(a) * pr,
                p.size * 0.56,
                p.size * 0.36,
                a,
                0,
                Math.PI * 2,
              )
              context.fill()
            }
            context.fillStyle = `rgba(255, 248, 220, ${p.alpha * 0.95})`
            context.beginPath()
            context.arc(0, 0, p.size * 0.24, 0, Math.PI * 2)
            context.fill()
            context.restore()
          } else {
            // Soft horizontal silver-gold moonlight shimmer glint on West Lake surface
            const glint = Math.sin(elapsed * p.spin + p.phase) ** 4
            if (glint > 0.08) {
              const a = p.alpha * glint
              const grad = context.createLinearGradient(p.x - p.size, p.y, p.x + p.size, p.y)
              grad.addColorStop(0, 'rgba(255, 248, 222, 0)')
              grad.addColorStop(0.5, `rgba(255, 248, 222, ${a})`)
              grad.addColorStop(1, 'rgba(255, 248, 222, 0)')
              context.fillStyle = grad
              context.fillRect(p.x - p.size, p.y - 0.9, p.size * 2, 1.8)
            }
          }
        }
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
      particles.forEach((p) => resetParticle(p, true))
      ripples.forEach((r) => resetRipple(r, true))
    },

    setDensity(streakCount, rippleCount) {
      const pCount = particleCapFor(streakCount)
      const rCount = rippleCapFor(rippleCount)
      particles = Array.from({ length: pCount }, () => {
        const p: Particle = {
          angle: 0,
          alpha: 0.5,
          depth: 0.5,
          kind: 0,
          phase: 0,
          size: 2,
          spin: 1,
          tone: 0,
          vx: 0,
          vy: 0,
          x: 0,
          y: 0,
        }
        resetParticle(p, true)
        return p
      })
      ripples = Array.from({ length: rCount }, () => {
        const r: WaterRipple = { x: 0, y: 0, age: 0, life: 2, scale: 1 }
        resetRipple(r, true)
        return r
      })
    },
  }
}
