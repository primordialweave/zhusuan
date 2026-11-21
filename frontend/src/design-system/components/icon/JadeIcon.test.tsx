import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import { JadeIcon } from './JadeIcon'
import { JadeIconDefs } from './JadeIconDefs'
import { JADE_ICON_REGISTRY, type JadeIconName } from './registry'

describe('JadeIcon & JadeIconDefs', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.removeAttribute('data-motion')
  })
  it('mounts shared theme-reactive gradients once without duplicating defs per icon', () => {
    const { container } = render(
      <>
        <JadeIconDefs />
        <JadeIcon name="edit" tone="jade" />
        <JadeIcon name="download" tone="jade" />
        <JadeIcon detail="carved" name="dock-settings" tone="jade" />
      </>,
    )

    expect(container.querySelectorAll('[data-slot="jade-icon-defs"]')).toHaveLength(1)
    expect(container.querySelector('#ods-jade-icon-grad-jade')).toHaveAttribute(
      'gradientUnits',
      'userSpaceOnUse',
    )
    expect(container.querySelector('#ods-jade-scene-grad-beam')).toHaveAttribute(
      'gradientUnits',
      'userSpaceOnUse',
    )
    expect(container.querySelector('#ods-jade-icon-grad-on-accent')).not.toBeNull()
    expect(container.querySelector('#ods-jade-icon-grad-specular')).not.toBeNull()
    expect(container.querySelectorAll('[data-slot="jade-icon"] defs')).toHaveLength(0)
  })

  it.each(Object.keys(JADE_ICON_REGISTRY) as JadeIconName[])(
    'renders %s cleanly on a 24x24 grid',
    (name) => {
      const { container } = render(<JadeIcon name={name} />)
      const svg = container.querySelector('[data-slot="jade-icon"]')
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg?.querySelector('.ods-jade-icon__body')).not.toBeNull()
      expect(svg?.querySelector('.ods-jade-icon__depth')).not.toBeNull()
      expect(svg?.querySelector('.ods-jade-icon__specular')).not.toBeNull()
    },
  )

  it('omits depth and specular layers in ink mode and supports labelled img semantics', () => {
    render(<JadeIcon label="关闭" name="close" size={20} tone="ink" />)
    const icon = screen.getByRole('img', { name: '关闭' })
    expect(icon).toHaveAttribute('width', '20px')
    expect(icon).toHaveAttribute('height', '20px')
    expect(icon.querySelector('.ods-jade-icon__depth')).toBeNull()
    expect(icon.querySelector('.ods-jade-icon__specular')).toBeNull()
  })

  it('maps carved detail to 1px static underside offset and subtle detail to 0.5px', () => {
    const { rerender, container } = render(<JadeIcon detail="subtle" name="edit" />)
    expect(container.querySelector('.ods-jade-icon__depth')).toHaveAttribute(
      'transform',
      'translate(0 0.5)',
    )

    rerender(<JadeIcon detail="carved" name="dock-projects" />)
    expect(container.querySelector('.ods-jade-icon__depth')).toHaveAttribute(
      'transform',
      'translate(0 1)',
    )
  })

  it('plays the saved check reaction once per eventKey and resets after 800ms', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(
      <JadeIcon name="download" reaction={{ eventKey: 0, kind: 'saved' }} />,
    )
    const svg = container.querySelector('[data-slot="jade-icon"]')
    expect(svg).not.toHaveAttribute('data-reaction-active')

    rerender(<JadeIcon name="download" reaction={{ eventKey: 1, kind: 'saved' }} />)
    expect(svg).toHaveAttribute('data-reaction-active', 'true')

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(svg).not.toHaveAttribute('data-reaction-active')

    // Re-rendering with the same eventKey must not replay the reaction
    rerender(<JadeIcon name="download" reaction={{ eventKey: 1, kind: 'saved' }} />)
    expect(svg).not.toHaveAttribute('data-reaction-active')
  })

  it('clears active check state immediately if reaction is removed mid-hold', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(
      <JadeIcon name="download" reaction={{ eventKey: 1, kind: 'saved' }} />,
    )
    const svg = container.querySelector('[data-slot="jade-icon"]')
    expect(svg).toHaveAttribute('data-reaction-active', 'true')

    // Navigating to another project clears reaction before the 800ms timer fires.
    rerender(<JadeIcon name="download" reaction={undefined} />)
    expect(svg).not.toHaveAttribute('data-reaction-active')

    // Returning to a fresh saved reaction replays cleanly.
    rerender(<JadeIcon name="download" reaction={{ eventKey: 1, kind: 'saved' }} />)
    expect(svg).toHaveAttribute('data-reaction-active', 'true')
  })

  it('skips WAAPI bell rotation when in-app data-motion="reduced" is active', () => {
    const animateSpy = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
    const { container, rerender } = render(<JadeIcon name="bell" />)
    const bellPart = container.querySelector('[data-jade-part="bell-body"]') as SVGGElement
    bellPart.animate = animateSpy

    document.documentElement.setAttribute('data-motion', 'reduced')
    rerender(<JadeIcon name="bell" reaction={{ eventKey: 1, kind: 'newUnread' }} />)
    expect(animateSpy).not.toHaveBeenCalled()

    document.documentElement.removeAttribute('data-motion')
    rerender(<JadeIcon name="bell" reaction={{ eventKey: 2, kind: 'newUnread' }} />)
    expect(animateSpy).toHaveBeenCalledTimes(1)
  })
})
