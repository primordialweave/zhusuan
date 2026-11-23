import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRainRenderer } from './renderRain2D'
import { createSceneGLRenderer } from './renderSceneGL'
import { SCENE_QUALITY } from './sceneFrame'
import { startSceneRuntime, type SceneRuntime } from './sceneRuntime'

vi.mock('./renderSceneGL', () => ({ createSceneGLRenderer: vi.fn() }))
vi.mock('./renderRain2D', () => ({ createRainRenderer: vi.fn() }))

const createGL = (frameMs: number[] = [1]) => {
  const measured = [...frameMs]
  return {
    dispose: vi.fn(),
    measureFrameMs: vi.fn(() => (measured.length > 1 ? measured.shift()! : measured[0])),
    render: vi.fn(),
    resize: vi.fn(),
  }
}

const createRain = () => ({ render: vi.fn(), resize: vi.fn(), setDensity: vi.fn() })

describe('scene runtime', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextFrameId: number
  let now: number
  let hidden: boolean
  let stage: HTMLDivElement
  let glCanvas: HTMLCanvasElement
  let rainCanvas: HTMLCanvasElement
  let runtime: SceneRuntime | undefined
  let failImages: boolean

  /** Runs the animation frame that is due after the given number of milliseconds. */
  const advance = (milliseconds: number) => {
    now += milliseconds
    const due = [...frames.values()]
    frames.clear()
    due.forEach((callback) => callback(now))
  }

  const start = (overrides: { signal?: AbortSignal } = {}) => {
    const onActiveChange = vi.fn()
    const promise = startSceneRuntime({
      glCanvas,
      masksUrl: 'masks.webp',
      onActiveChange,
      rainCanvas,
      sceneUrl: 'scene.webp',
      signal: overrides.signal ?? new AbortController().signal,
    })
    return { onActiveChange, promise }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    frames = new Map()
    nextFrameId = 0
    now = 1000
    hidden = false
    failImages = false
    runtime = undefined

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        nextFrameId += 1
        frames.set(nextFrameId, callback)
        return nextFrameId
      }),
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        frames.delete(id)
      }),
    )
    vi.stubGlobal(
      'Image',
      class {
        decoding = ''
        onerror: (() => void) | null = null
        onload: (() => void) | null = null

        set src(_value: string) {
          queueMicrotask(() => (failImages ? this.onerror?.() : this.onload?.()))
        }
      },
    )
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)

    stage = document.createElement('div')
    Object.defineProperties(stage, {
      clientHeight: { value: 800 },
      clientWidth: { value: 1280 },
    })
    glCanvas = document.createElement('canvas')
    rainCanvas = document.createElement('canvas')
    stage.append(glCanvas, rainCanvas)
    document.body.append(stage)

    vi.mocked(createSceneGLRenderer).mockImplementation(() => createGL())
    vi.mocked(createRainRenderer).mockImplementation(() => createRain())
  })

  afterEach(() => {
    runtime?.dispose()
    stage.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete document.documentElement.dataset.nativeWindowVisibility
  })

  it('stays stopped when native hide arrives while the scene images are still loading', async () => {
    const { promise } = start()
    window.dispatchEvent(new CustomEvent('zhusuan:window-visibility', { detail: { hidden: true } }))
    runtime = await promise
    expect(frames.size).toBe(0)
    window.dispatchEvent(
      new CustomEvent('zhusuan:window-visibility', { detail: { hidden: false } }),
    )
    expect(frames.size).toBe(1)
  })

  it('starts from the latched native hidden state even when document.hidden is false', async () => {
    document.documentElement.dataset.nativeWindowVisibility = 'hidden'
    runtime = await start().promise
    expect(frames.size).toBe(0)
    window.dispatchEvent(
      new CustomEvent('zhusuan:window-visibility', { detail: { hidden: false } }),
    )
    expect(frames.size).toBe(1)
  })

  it('creates nothing when the start is cancelled while the images load', async () => {
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const controller = new AbortController()
    const { onActiveChange, promise } = start({ signal: controller.signal })
    controller.abort()
    runtime = await promise

    expect(createSceneGLRenderer).not.toHaveBeenCalled()
    expect(createRainRenderer).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
    expect(onActiveChange).not.toHaveBeenCalled()
    expect(() => runtime!.dispose()).not.toThrow()
    expect(removeListener).toHaveBeenCalledWith('zhusuan:window-visibility', expect.any(Function))
  })

  it('rejects when the scene cannot be loaded so the still simply stays', async () => {
    const removeListener = vi.spyOn(window, 'removeEventListener')
    failImages = true

    await expect(start().promise).rejects.toThrow('Unable to load')
    expect(createSceneGLRenderer).not.toHaveBeenCalled()
    expect(removeListener).toHaveBeenCalledWith('zhusuan:window-visibility', expect.any(Function))
  })

  it('draws both layers on the first frame, then reports them once', async () => {
    const gl = createGL()
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    const { onActiveChange, promise } = start()
    runtime = await promise

    expect(onActiveChange).not.toHaveBeenCalled()
    advance(0)

    expect(gl.render).toHaveBeenCalledTimes(1)
    expect(rain.render).toHaveBeenCalledTimes(1)
    expect(onActiveChange).toHaveBeenCalledTimes(1)
    expect(onActiveChange).toHaveBeenCalledWith({ gl: true, rain: true })

    advance(16.7)
    expect(onActiveChange).toHaveBeenCalledTimes(1)
  })

  it('spends the same on a 120Hz display as on a 60Hz one', async () => {
    const gl = createGL()
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    runtime = await start().promise
    advance(0)
    gl.render.mockClear()
    rain.render.mockClear()

    // One second of 120Hz frames.
    for (let frameIndex = 0; frameIndex < 120; frameIndex += 1) advance(1000 / 120)

    expect(gl.render.mock.calls.length).toBeGreaterThanOrEqual(28)
    expect(gl.render.mock.calls.length).toBeLessThanOrEqual(31)
    expect(rain.render.mock.calls.length).toBeGreaterThanOrEqual(58)
    expect(rain.render.mock.calls.length).toBeLessThanOrEqual(61)
  })

  it('does not replay a stall as one long leap', async () => {
    const gl = createGL()
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    runtime = await start().promise
    advance(0)
    advance(3000)

    expect(rain.render).toHaveBeenLastCalledWith(0.05)
    expect(gl.render).toHaveBeenLastCalledWith(0.05)
  })

  it('stops while the window is hidden and resumes without a jump', async () => {
    const gl = createGL()
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    runtime = await start().promise
    advance(0)
    advance(100)
    const elapsedBeforeHiding = gl.render.mock.lastCall![0] as number

    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(0)

    now += 60_000
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(1)
    advance(0)

    expect(gl.render.mock.lastCall![0]).toBe(elapsedBeforeHiding)
    expect(rain.render).toHaveBeenLastCalledWith(0)
  })

  it('does not start a loop for a window that is hidden from the beginning', async () => {
    hidden = true
    runtime = await start().promise

    expect(frames.size).toBe(0)
  })

  it('keeps a single loop however often visibility is reported', async () => {
    runtime = await start().promise

    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))

    expect(frames.size).toBe(1)
  })

  it('releases the loop, the listeners and the GPU resources on dispose', async () => {
    const gl = createGL()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    runtime = await start().promise
    advance(0)

    runtime.dispose()

    expect(frames.size).toBe(0)
    expect(gl.dispose).toHaveBeenCalledTimes(1)

    document.dispatchEvent(new Event('visibilitychange'))
    glCanvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(frames.size).toBe(0)
    expect(createSceneGLRenderer).toHaveBeenCalledTimes(1)
  })

  it('starts at the standard profile on a capable device', async () => {
    const gl = createGL([2])
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    runtime = await start().promise

    expect(gl.measureFrameMs).toHaveBeenCalledTimes(1)
    expect(rain.setDensity).toHaveBeenCalledTimes(1)
    expect(rain.setDensity).toHaveBeenCalledWith(
      SCENE_QUALITY.standard.rainCount,
      SCENE_QUALITY.standard.rippleCount,
    )
  })

  it('steps down to the low profile when a frame is slow', async () => {
    const gl = createGL([18, 9])
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    const { onActiveChange, promise } = start()
    runtime = await promise
    advance(0)

    expect(rain.setDensity).toHaveBeenLastCalledWith(
      SCENE_QUALITY.low.rainCount,
      SCENE_QUALITY.low.rippleCount,
    )
    expect(gl.dispose).not.toHaveBeenCalled()
    expect(onActiveChange).toHaveBeenCalledWith({ gl: true, rain: true })
    const [standardWidth] = gl.resize.mock.calls[0]
    const [lowWidth] = gl.resize.mock.lastCall!
    expect(lowWidth).toBeLessThanOrEqual(standardWidth)
  })

  it('drops WebGL for good when even the low profile is too slow', async () => {
    const gl = createGL([40, 30])
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    const { onActiveChange, promise } = start()
    runtime = await promise
    advance(0)

    expect(gl.dispose).toHaveBeenCalledTimes(1)
    expect(gl.render).not.toHaveBeenCalled()
    expect(rain.render).toHaveBeenCalledTimes(1)
    expect(onActiveChange).toHaveBeenCalledWith({ gl: false, rain: true })

    glCanvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(createSceneGLRenderer).toHaveBeenCalledTimes(1)
  })

  it('falls back to rain over the still when WebGL2 is unavailable', async () => {
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockImplementation(() => {
      throw new Error('WebGL2 is unavailable')
    })
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    const { onActiveChange, promise } = start()
    runtime = await promise
    advance(0)

    expect(rain.render).toHaveBeenCalledTimes(1)
    expect(onActiveChange).toHaveBeenCalledWith({ gl: false, rain: true })
  })

  it('runs no loop at all when neither layer can be created', async () => {
    vi.mocked(createSceneGLRenderer).mockImplementation(() => {
      throw new Error('WebGL2 is unavailable')
    })
    vi.mocked(createRainRenderer).mockImplementation(() => {
      throw new Error('Canvas 2D is unavailable')
    })
    const { onActiveChange, promise } = start()
    runtime = await promise

    expect(frames.size).toBe(0)
    expect(onActiveChange).not.toHaveBeenCalled()
  })

  it('shows the still through a lost context and rebuilds once it is restored', async () => {
    const first = createGL()
    const second = createGL()
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValueOnce(first).mockReturnValueOnce(second)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    const { onActiveChange, promise } = start()
    runtime = await promise
    advance(0)

    const lost = new Event('webglcontextlost', { cancelable: true })
    glCanvas.dispatchEvent(lost)

    expect(lost.defaultPrevented).toBe(true)
    expect(onActiveChange).toHaveBeenLastCalledWith({ gl: false, rain: true })
    first.render.mockClear()
    advance(50)
    expect(first.render).not.toHaveBeenCalled()
    expect(rain.render).toHaveBeenCalledTimes(2)

    glCanvas.dispatchEvent(new Event('webglcontextrestored'))

    expect(onActiveChange).toHaveBeenLastCalledWith({ gl: true, rain: true })
    expect(second.resize).toHaveBeenCalled()
    advance(50)
    expect(second.render).toHaveBeenCalledTimes(1)
  })

  it('stops the loop when the only layer is lost and restarts it on restore', async () => {
    vi.mocked(createRainRenderer).mockImplementation(() => {
      throw new Error('Canvas 2D is unavailable')
    })
    const restored = createGL()
    vi.mocked(createSceneGLRenderer).mockReturnValueOnce(createGL()).mockReturnValueOnce(restored)
    runtime = await start().promise
    advance(0)
    expect(frames.size).toBe(1)

    glCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(frames.size).toBe(0)

    glCanvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(frames.size).toBe(1)
    advance(0)
    expect(restored.render).toHaveBeenCalledTimes(1)
  })

  it('re-lays out on resize without rebuilding the particle pools', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback
        }

        disconnect = disconnect
        observe = observe
        unobserve = vi.fn()
      },
    )
    const gl = createGL()
    const rain = createRain()
    vi.mocked(createSceneGLRenderer).mockReturnValue(gl)
    vi.mocked(createRainRenderer).mockReturnValue(rain)
    runtime = await start().promise

    expect(observe).toHaveBeenCalledWith(stage)
    const resizesBefore = gl.resize.mock.calls.length
    resizeCallback?.([], {} as ResizeObserver)
    resizeCallback?.([], {} as ResizeObserver)

    expect(gl.resize).toHaveBeenCalledTimes(resizesBefore + 2)
    expect(rain.resize).toHaveBeenCalledTimes(resizesBefore + 2)
    expect(rain.setDensity).toHaveBeenCalledTimes(1)

    runtime.dispose()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
