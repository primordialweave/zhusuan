import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@/test/render'
import AppLayout from './AppLayout'
import '@/styles/layout.css'

const { toggleMaximise } = vi.hoisted(() => ({
  toggleMaximise: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@wailsio/runtime', () => ({
  Window: { ToggleMaximise: toggleMaximise },
}))

describe('AppLayout', () => {
  test('renders a real draggable titlebar surface ahead of the main content', () => {
    const { container } = render(<AppLayout />, { initialEntries: ['/dashboard'] })

    const dragRegion = container.querySelector('.app-titlebar-drag-region')

    expect(dragRegion).toBeInTheDocument()
    expect(dragRegion).toHaveAttribute('aria-hidden', 'true')
    expect(dragRegion?.nextElementSibling).toBe(screen.getByRole('main'))
    expect(container.querySelector('.app-topbar')).not.toBeInTheDocument()
  })

  test('toggles native maximise on titlebar drag-region double click', () => {
    const { container } = render(<AppLayout />, { initialEntries: ['/dashboard'] })
    const dragRegion = container.querySelector('.app-titlebar-drag-region')

    expect(dragRegion).toBeInTheDocument()
    fireEvent.doubleClick(dragRegion!)

    expect(toggleMaximise).toHaveBeenCalledTimes(1)
  })

  test('leaves the workbench as the bare scene', () => {
    const { container } = render(<AppLayout />, { initialEntries: ['/dashboard'] })

    expect(container.querySelector('.app-container')).toHaveAttribute('data-view', 'workbench')
    expect(container.querySelector('.jiangnan-scene')).toHaveAttribute('data-variant', 'workbench')
    expect(container.querySelector('.ods-work-surface')).not.toBeInTheDocument()
  })

  test.each(['/projects', '/projects/42', '/calendar', '/analytics', '/settings'])(
    'puts %s on the work surface over the quiet scene',
    (pathname) => {
      const { container } = render(<AppLayout />, { initialEntries: [pathname] })

      expect(container.querySelector('.app-container')).toHaveAttribute('data-view', 'business')
      expect(container.querySelector('.jiangnan-scene')).toHaveAttribute('data-variant', 'business')
      expect(screen.getByRole('main')).toContainElement(
        container.querySelector('.ods-work-surface'),
      )
      // Business pages never mount the animated layers.
      expect(container.querySelector('.jiangnan-scene canvas')).not.toBeInTheDocument()
    },
  )

  test('keeps the scene out of the accessibility tree', () => {
    const { container } = render(<AppLayout />, { initialEntries: ['/dashboard'] })

    expect(container.querySelector('.jiangnan-scene')).toHaveAttribute('aria-hidden', 'true')
  })

  test('shows no notification trigger while nothing is unread', () => {
    render(<AppLayout />, { initialEntries: ['/dashboard'] })

    expect(screen.queryByRole('button', { name: /查看通知/ })).not.toBeInTheDocument()
  })
})
