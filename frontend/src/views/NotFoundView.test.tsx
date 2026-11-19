import { useEffect } from 'react'
import { act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@/test/render'
import NotFoundView from './NotFoundView'

function RouteProbe({ onNavigate }: { onNavigate?: (navigate: NavigateFunction) => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    onNavigate?.(navigate)
  }, [navigate, onNavigate])

  return <output data-testid="location">{location.pathname}</output>
}

describe('NotFoundView', () => {
  afterEach(() => {
    window.history.replaceState(null, '')
  })

  it('names what happened and leads home from a frosted card', () => {
    render(<NotFoundView />, { initialEntries: ['/nowhere'] })

    const card = screen.getByRole('region', { name: '页面走丢了' })
    expect(card).toHaveClass('ods-cloud-panel')
    expect(card).toHaveAttribute('data-align', 'center')
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '页面走丢了' })).toBeInTheDocument()

    const home = screen.getByRole('link', { name: '返回首页' })
    expect(home).toHaveAttribute('href', '/dashboard')
    expect(home).toHaveClass('ods-button')
    expect(home).toHaveAttribute('data-variant', 'primary')
  })

  it('offers no way back when this is the first page of the visit', () => {
    render(<NotFoundView />, { initialEntries: ['/nowhere'] })

    expect(screen.queryByRole('button', { name: '返回上一页' })).not.toBeInTheDocument()
  })

  it('goes back to where the visitor came from', async () => {
    const user = userEvent.setup()
    // React Router keeps the entry's depth in history.state; the view reads it from there.
    window.history.replaceState({ idx: 1 }, '')
    let routeNavigate: NavigateFunction | null = null
    render(
      <>
        <NotFoundView />
        <RouteProbe onNavigate={(navigate) => (routeNavigate = navigate)} />
      </>,
      { initialEntries: ['/projects'] },
    )
    act(() => routeNavigate?.('/nowhere'))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/nowhere'))

    await user.click(screen.getByRole('button', { name: '返回上一页' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/projects'))
  })
})
