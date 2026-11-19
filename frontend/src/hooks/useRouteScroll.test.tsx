import { useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@/test/render'
import { useRouteScroll } from './useRouteScroll'

function Harness() {
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  useRouteScroll(ref)
  return (
    <div aria-label="页面滚动区" ref={ref}>
      <div>
        <h1>{location.pathname}</h1>
        <Link to="/projects">项目</Link>
        <Link to="?filter=active">筛选</Link>
        <Link to="?view=month">完整列表</Link>
        <button onClick={() => navigate(-1)}>返回</button>
      </div>
    </div>
  )
}

describe('route scroll restoration', () => {
  it('resets new screens, preserves filters, and restores history entries', async () => {
    const user = userEvent.setup()
    render(<Harness />, { initialEntries: ['/dashboard'] })
    const scroll = screen.getByLabelText('页面滚动区')
    Object.defineProperties(scroll, { scrollHeight: { value: 2000 }, clientHeight: { value: 600 } })
    scroll.scrollTop = 450
    fireEvent.scroll(scroll)

    screen.getByRole('link', { name: '项目' }).focus()
    await user.keyboard('{Enter}')
    expect(scroll.scrollTop).toBe(0)
    expect(screen.getByRole('heading', { name: '/projects' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(scroll.scrollTop).toBe(450)

    await user.click(screen.getByRole('link', { name: '筛选' }))
    expect(scroll.scrollTop).toBe(450)
    scroll.scrollTop = 250
    fireEvent.scroll(scroll)
    await user.click(screen.getByRole('link', { name: '完整列表' }))
    expect(scroll.scrollTop).toBe(0)
    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(scroll.scrollTop).toBe(250)
  })
})
