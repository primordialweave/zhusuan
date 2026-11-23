import { act, render, waitFor } from '@testing-library/react'
import { Call } from '@wailsio/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDesktopStore } from '@/stores/desktop'
import { useSceneAnimationEnabled, useSceneRuntime } from './useSceneRuntime'

const { loadAssets, startRuntime, dispose } = vi.hoisted(() => ({
  loadAssets: vi.fn(),
  startRuntime: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('@/config/themes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/themes')>()),
  loadThemePackAssets: loadAssets,
}))
vi.mock('@/scene/sceneRuntime', () => ({ startSceneRuntime: startRuntime }))

const assets = {
  sceneUrl: 'scene.webp',
  masksUrl: 'masks.webp',
  businessUrl: 'business.webp',
  frostUrl: 'frost.webp',
}

function SceneProbe() {
  const animate = useSceneAnimationEnabled(true)
  const { glCanvasRef, rainCanvasRef } = useSceneRuntime(animate)
  return (
    <div>
      {animate ? (
        <>
          <canvas ref={glCanvasRef} />
          <canvas ref={rainCanvasRef} />
        </>
      ) : null}
    </div>
  )
}

describe('native scene readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadAssets.mockReset().mockResolvedValue(assets)
    startRuntime.mockReset().mockResolvedValue({ dispose })
    vi.stubGlobal('_wails', { environment: { OS: 'darwin' } })
    vi.stubGlobal('__WAILS__', undefined)
    vi.stubGlobal('WebGL2RenderingContext', class {})
    useDesktopStore.setState({ state: null, windowHidden: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for existing native state, remains still on a hidden launch, and starts only when shown', async () => {
    const { container } = render(<SceneProbe />)
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(loadAssets).not.toHaveBeenCalled()
    act(() => {
      useDesktopStore.setState({ state: {} as never, windowHidden: true })
    })
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    act(() => {
      useDesktopStore.setState({ windowHidden: false })
    })
    await waitFor(() => expect(startRuntime).toHaveBeenCalledOnce())
    expect(container.querySelectorAll('canvas')).toHaveLength(2)
    act(() => {
      useDesktopStore.setState({ windowHidden: true })
    })
    expect(dispose).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(Call.ByName).not.toHaveBeenCalled()
  })

  it('cancels a deferred asset startup when native hide precedes resource completion', async () => {
    let resolveAssets!: (value: typeof assets) => void
    loadAssets.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAssets = resolve
      }),
    )
    useDesktopStore.setState({ state: {} as never, windowHidden: false })
    render(<SceneProbe />)
    await waitFor(() => expect(loadAssets).toHaveBeenCalledOnce())
    act(() => {
      useDesktopStore.setState({ windowHidden: true })
    })
    await act(async () => {
      resolveAssets(assets)
    })
    expect(startRuntime).not.toHaveBeenCalled()
    act(() => {
      useDesktopStore.setState({ windowHidden: false })
    })
    await waitFor(() => expect(startRuntime).toHaveBeenCalledOnce())
  })

  it('lets a browser scene start without native initialization or IPC', async () => {
    vi.stubGlobal('_wails', undefined)
    useDesktopStore.setState({ state: null, windowHidden: true })
    const { container } = render(<SceneProbe />)
    await waitFor(() => expect(startRuntime).toHaveBeenCalledOnce())
    expect(container.querySelectorAll('canvas')).toHaveLength(2)
    expect(Call.ByName).not.toHaveBeenCalled()
  })
})
