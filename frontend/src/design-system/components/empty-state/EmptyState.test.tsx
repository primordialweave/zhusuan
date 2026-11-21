import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyScene } from './EmptyScene'
import { EmptyState } from './EmptyState'
import { JadeIcon } from '../icon'

describe('EmptyState', () => {
  it('renders accessible copy, decorative media, and an optional action', () => {
    const { container } = render(
      <EmptyState
        action={<button type="button">新建项目</button>}
        description="创建第一条记录后，数据会显示在这里。"
        icon={<JadeIcon name="folder-open" size="1em" />}
        size="lg"
        title="暂无项目"
      />,
    )

    expect(screen.getByRole('heading', { name: '暂无项目' })).toBeInTheDocument()
    expect(screen.getByText('创建第一条记录后，数据会显示在这里。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建项目' })).toBeInTheDocument()
    expect(container.firstChild).toHaveAttribute('data-size', 'lg')
    expect(container.querySelector('.ods-empty-state__icon')).toHaveAttribute('aria-hidden', 'true')
  })

  it('forwards native props and omits optional regions', () => {
    const { container } = render(<EmptyState className="custom-empty" title="暂无数据" />)

    expect(container.firstChild).toHaveClass('ods-empty-state', 'custom-empty')
    expect(container.firstChild).toHaveAttribute('data-size', 'md')
    expect(container.querySelector('.ods-empty-state__icon')).toBeInTheDocument()
    expect(container.querySelector('.ods-empty-state__description')).not.toBeInTheDocument()
    expect(container.querySelector('.ods-empty-state__action')).not.toBeInTheDocument()
  })

  it('renders brand EmptyScene without the default icon badge when scene prop is provided', () => {
    const { container } = render(
      <EmptyState
        scene={<EmptyScene name="projects-empty" size="hero" />}
        size="lg"
        title="暂无项目"
      />,
    )

    expect(container.firstChild).toHaveAttribute('data-presentation', 'scene')
    expect(container.querySelector('.ods-empty-state__icon')).not.toBeInTheDocument()
    const scene = container.querySelector('[data-slot="empty-scene"]')
    expect(scene).toHaveAttribute('data-scene', 'projects-empty')
    expect(scene).toHaveAttribute('height', '96')
    expect(scene).toHaveAttribute('viewBox', '0 0 160 112')
  })
})
