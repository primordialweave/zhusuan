import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// The SDK root starts native DOM handlers and a drag polling timer at import time.
// Frontend tests exercise the host bridge through mocks, while generated bindings still
// use the SDK's pure value converters and cancellable promises.
vi.mock('@wailsio/runtime', async () => {
  const cancellable = await vi.importActual<typeof import('@wailsio/runtime/cancellable')>(
    '@wailsio/runtime/cancellable',
  )
  const Create = await vi.importActual<(typeof import('@wailsio/runtime'))['Create']>(
    '../../node_modules/@wailsio/runtime/dist/create.js',
  )
  return {
    ...cancellable,
    Create,
    Call: {
      ByID: vi.fn(() => cancellable.CancellablePromise.resolve(null)),
      ByName: vi.fn(() => cancellable.CancellablePromise.resolve(undefined)),
    },
    Browser: { OpenURL: vi.fn().mockResolvedValue(undefined) },
    Window: { ToggleMaximise: vi.fn().mockResolvedValue(undefined) },
    Events: { Types: { Common: {} }, On: vi.fn(() => () => {}) },
  }
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
})
