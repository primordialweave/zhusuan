import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadStore = () => import('./appearance')

const preferences = (state: {
  liquidGlass: boolean
  reduceMotion: boolean
  sceneMotion: boolean
}) => ({
  liquidGlass: state.liquidGlass,
  reduceMotion: state.reduceMotion,
  sceneMotion: state.sceneMotion,
})

describe('appearance store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-glass')
    document.documentElement.removeAttribute('data-motion')
  })

  it('starts from the defaults when nothing is stored', async () => {
    const { DEFAULT_APPEARANCE, useAppearanceStore } = await loadStore()

    expect(preferences(useAppearanceStore.getState())).toEqual(DEFAULT_APPEARANCE)
    expect(DEFAULT_APPEARANCE).toEqual({
      liquidGlass: true,
      reduceMotion: false,
      sceneMotion: true,
    })
  })

  it('restores stored switches and falls back per key on a bad value', async () => {
    window.localStorage.setItem(
      'zhusuan.appearance.v1',
      JSON.stringify({ liquidGlass: false, reduceMotion: 'yes', sceneMotion: false }),
    )
    const { useAppearanceStore } = await loadStore()

    expect(preferences(useAppearanceStore.getState())).toEqual({
      liquidGlass: false,
      reduceMotion: false,
      sceneMotion: false,
    })
  })

  it.each(['{not json', 'null', '[1, 2]', '"text"'])(
    'falls back to the defaults for stored %s',
    async (stored) => {
      window.localStorage.setItem('zhusuan.appearance.v1', stored)
      const { DEFAULT_APPEARANCE, useAppearanceStore } = await loadStore()

      expect(preferences(useAppearanceStore.getState())).toEqual(DEFAULT_APPEARANCE)
    },
  )

  it('saves a change at once and reflects it on the root element', async () => {
    const { APPEARANCE_STORAGE_KEY, useAppearanceStore } = await loadStore()

    useAppearanceStore.getState().setPreference('liquidGlass', false)
    useAppearanceStore.getState().setPreference('reduceMotion', true)

    expect(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual({
      liquidGlass: false,
      reduceMotion: true,
      sceneMotion: true,
    })
    expect(document.documentElement).toHaveAttribute('data-glass', 'solid')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')

    useAppearanceStore.getState().setPreference('liquidGlass', true)
    useAppearanceStore.getState().setPreference('reduceMotion', false)

    expect(document.documentElement).not.toHaveAttribute('data-glass')
    expect(document.documentElement).not.toHaveAttribute('data-motion')
  })

  it('applies the stored preferences before the first render', async () => {
    window.localStorage.setItem(
      'zhusuan.appearance.v1',
      JSON.stringify({ liquidGlass: false, reduceMotion: true, sceneMotion: true }),
    )
    const { applyAppearanceBeforeRender } = await loadStore()

    applyAppearanceBeforeRender()

    expect(document.documentElement).toHaveAttribute('data-glass', 'solid')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
  })

  it('still applies a change for the session when storage is unavailable', async () => {
    const { useAppearanceStore } = await loadStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => useAppearanceStore.getState().setPreference('sceneMotion', false)).not.toThrow()
    expect(useAppearanceStore.getState().sceneMotion).toBe(false)
  })
})
