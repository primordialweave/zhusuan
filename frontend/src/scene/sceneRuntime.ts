import { createRainRenderer, type RainRenderer } from './renderRain2D'
import { createSceneGLRenderer, type SceneGLRenderer } from './renderSceneGL'
import { getRenderScale, getSceneCrop, SCENE_QUALITY, type SceneQuality } from './sceneFrame'

export interface SceneRuntimeOptions {
  glCanvas: HTMLCanvasElement
  rainCanvas: HTMLCanvasElement
  masksUrl: string
  sceneUrl: string
  /** Called once the first animated frame is on screen, and again when a layer is lost or back. */
  onActiveChange: (layers: { gl: boolean; rain: boolean }) => void
  /** Aborting before start-up finishes prevents any GPU resource from being created. */
  signal: AbortSignal
}

export interface SceneRuntime {
  dispose: () => void
}

/** Longest simulation step, so rain does not leap after a stall. */
const MAX_STEP_SECONDS = 0.05
/** Water and willow drift slowly, so the shader is capped near 30fps; rain near 60fps. */
const GL_INTERVAL_SECONDS = 1 / 30
const RAIN_INTERVAL_SECONDS = 1 / 60
/** Display refresh jitters by a millisecond or two; without slack every other frame is skipped. */
const INTERVAL_SLACK_SECONDS = 0.002
/** GPU milliseconds per frame above which the scene steps down, then gives up on WebGL. */
const SLOW_FRAME_MS = 12
const STALLED_FRAME_MS = 24

const idleRuntime: SceneRuntime = { dispose() {} }

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load ${url}`))
    image.src = url
  })

/**
 * Runs the animated scene: WebGL2 for water, mist and willow, Canvas 2D for rain.
 *
 * Either layer may be missing; the still underneath always remains. Quality is chosen once from
 * a measured frame, not from frame intervals: browsers throttle unfocused windows, which would
 * read as a slow device. Both layers render on a time budget, so a 120Hz display costs no more
 * than a 60Hz one, and the loop stops while the document is hidden.
 */
export async function startSceneRuntime(options: SceneRuntimeOptions): Promise<SceneRuntime> {
  const { glCanvas, masksUrl, onActiveChange, rainCanvas, sceneUrl, signal } = options
  const stage = glCanvas.parentElement
  let disposed = false
  let quality: SceneQuality = 'standard'
  let appliedQuality: SceneQuality | null = null
  let gl: SceneGLRenderer | null = null
  let glAllowed = true
  let rain: RainRenderer | null = null
  let frame = 0
  let lastTime = 0
  let elapsed = 0
  let sinceGL = 0
  let sinceRain = 0
  let announced = false

  const [sceneImage, masksImage] = await Promise.all([loadImage(sceneUrl), loadImage(masksUrl)])
  // One canvas owns one context, so a cancelled start must not touch it.
  if (signal.aborted) return idleRuntime

  const buildGL = (): SceneGLRenderer | null => {
    try {
      return createSceneGLRenderer(glCanvas, sceneImage, masksImage)
    } catch {
      return null
    }
  }
  gl = buildGL()
  try {
    rain = createRainRenderer(rainCanvas)
  } catch {
    rain = null
  }

  const layout = () => {
    const width = stage?.clientWidth ?? window.innerWidth
    const height = stage?.clientHeight ?? window.innerHeight
    if (width === 0 || height === 0) return
    const profile = SCENE_QUALITY[quality]
    const scale = getRenderScale(width, height, window.devicePixelRatio, profile)
    const crop = getSceneCrop(width, height)
    gl?.resize(Math.round(width * scale), Math.round(height * scale), crop)
    if (appliedQuality !== quality) {
      rain?.setDensity(profile.rainCount, profile.rippleCount)
      appliedQuality = quality
    }
    rain?.resize(width, height, scale, crop)
  }

  const reportLayers = () => onActiveChange({ gl: gl !== null, rain: rain !== null })

  const stop = () => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
  }

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    // The first frame after a start always draws, so the layers never fade in empty.
    const firstFrame = lastTime === 0
    const delta = firstFrame ? 0 : Math.max(0, (now - lastTime) / 1000)
    lastTime = now
    elapsed += Math.min(delta, MAX_STEP_SECONDS)
    sinceGL += delta
    sinceRain += delta

    if (gl && (firstFrame || sinceGL >= GL_INTERVAL_SECONDS - INTERVAL_SLACK_SECONDS)) {
      gl.render(elapsed)
      sinceGL = 0
    }
    if (rain && (firstFrame || sinceRain >= RAIN_INTERVAL_SECONDS - INTERVAL_SLACK_SECONDS)) {
      rain.render(Math.min(sinceRain, MAX_STEP_SECONDS))
      sinceRain = 0
    }
    if (!announced) {
      announced = true
      reportLayers()
    }
  }

  const start = () => {
    if (disposed || frame !== 0 || document.hidden || (!gl && !rain)) return
    // Restart the clock so time spent hidden is not replayed as one long step.
    lastTime = 0
    sinceGL = 0
    sinceRain = 0
    frame = requestAnimationFrame(tick)
  }

  const handleVisibility = () => {
    if (document.hidden) stop()
    else start()
  }

  const handleContextLost = (event: Event) => {
    // Allow the browser to restore the context; until then the still shows through.
    event.preventDefault()
    gl = null
    if (!rain) stop()
    reportLayers()
  }

  const handleContextRestored = () => {
    if (disposed || !glAllowed) return
    gl = buildGL()
    layout()
    reportLayers()
    start()
  }

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(layout)
  if (stage) observer?.observe(stage)
  document.addEventListener('visibilitychange', handleVisibility)
  glCanvas.addEventListener('webglcontextlost', handleContextLost)
  glCanvas.addEventListener('webglcontextrestored', handleContextRestored)

  layout()
  if (gl && gl.measureFrameMs() > SLOW_FRAME_MS) {
    quality = 'low'
    layout()
    if (gl.measureFrameMs() > STALLED_FRAME_MS) {
      // Too slow even at the low profile: keep the rain over the still and drop WebGL for good.
      gl.dispose()
      gl = null
      glAllowed = false
    }
  }
  start()

  return {
    dispose() {
      disposed = true
      stop()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      glCanvas.removeEventListener('webglcontextlost', handleContextLost)
      glCanvas.removeEventListener('webglcontextrestored', handleContextRestored)
      gl?.dispose()
      gl = null
      rain = null
    },
  }
}
