import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animateWithMotionPreference, cancelMotionAnimations } from './iconMotion'

describe('active motion preferences', () => {
  let media: EventTarget & { matches: boolean }
  const targets: Element[] = []

  beforeEach(() => {
    media = Object.assign(new EventTarget(), { matches: false })
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    )
  })

  afterEach(() => {
    for (const target of targets.splice(0)) cancelMotionAnimations(target, true)
    document.documentElement.removeAttribute('data-motion')
    vi.unstubAllGlobals()
  })

  const start = () => {
    const target = document.createElement('span')
    targets.push(target)
    let finish!: () => void
    let reject!: (error: unknown) => void
    const finished = new Promise<void>((resolve, rejectPromise) => {
      finish = resolve
      reject = rejectPromise
    })
    const cancel = vi.fn(() => reject(new DOMException('Cancelled', 'AbortError')))
    const animation = { cancel, finished } as unknown as Animation
    Object.assign(target, { animate: vi.fn(() => animation) })
    animateWithMotionPreference(target, [{ opacity: 1 }, { opacity: 0 }], { duration: 440 })
    return { animation, cancel, finish, target }
  }

  it('cancels an active effect when the app preference becomes reduced', async () => {
    const effect = start()
    document.documentElement.dataset.motion = 'reduced'
    await Promise.resolve()
    expect(effect.cancel).toHaveBeenCalledOnce()
    // A second preference event must not retain a listener or cancel an already disposed effect.
    media.matches = true
    media.dispatchEvent(new Event('change'))
    expect(effect.cancel).toHaveBeenCalledOnce()
  })

  it('cancels an active effect when the OS preference becomes reduced', async () => {
    const effect = start()
    media.matches = true
    media.dispatchEvent(new Event('change'))
    await Promise.resolve()
    expect(effect.cancel).toHaveBeenCalledOnce()
  })

  it('releases observation when an effect finishes normally', async () => {
    const effect = start()
    effect.finish()
    await Promise.resolve()
    document.documentElement.dataset.motion = 'reduced'
    media.matches = true
    media.dispatchEvent(new Event('change'))
    await Promise.resolve()
    expect(effect.cancel).not.toHaveBeenCalled()
  })

  it('cancels descendant effects during owner disposal and releases their listeners', async () => {
    const effect = start()
    const button = document.createElement('button')
    button.append(effect.target)
    cancelMotionAnimations(button, true)
    await Promise.resolve()
    media.matches = true
    media.dispatchEvent(new Event('change'))
    expect(effect.cancel).toHaveBeenCalledOnce()
  })
})
