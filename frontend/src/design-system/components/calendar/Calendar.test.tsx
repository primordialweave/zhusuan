import { useState } from 'react'
import dayjs from 'dayjs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Calendar } from './Calendar'

function Controlled() {
  const [value, setValue] = useState('2026-07-15')
  return <Calendar onValueChange={setValue} value={value} />
}

describe('Calendar', () => {
  it('renders the selected month and selects a day', async () => {
    render(<Controlled />)
    expect(screen.getByRole('button', { name: '选择年份' })).toHaveTextContent('2026 年')
    expect(document.querySelector('.ods-calendar')).toHaveAttribute('data-variant', 'secondary')

    await userEvent.click(screen.getByRole('button', { name: /2026年7月20日/ }))
    expect(screen.getByRole('button', { name: /2026年7月20日/ })).toHaveAttribute(
      'data-selected',
      'true',
    )
  })

  it('navigates to the previous month', async () => {
    render(<Controlled />)
    await userEvent.click(screen.getByRole('button', { name: '上个月' }))
    expect(screen.getByRole('button', { name: '选择月份' })).toHaveTextContent('6 月')
  })

  it('picks a year and month through the title buttons', async () => {
    render(<Controlled />)

    await userEvent.click(screen.getByRole('button', { name: '选择年份' }))
    await userEvent.click(screen.getByRole('button', { name: '2024' }))
    await userEvent.click(screen.getByRole('button', { name: '3月' }))

    expect(screen.getByRole('button', { name: '选择年份' })).toHaveTextContent('2024 年')
    expect(screen.getByRole('button', { name: '选择月份' })).toHaveTextContent('3 月')
  })

  it('supports a controlled visible month and reports month navigation', async () => {
    const onVisibleMonthChange = vi.fn()
    const { rerender } = render(
      <Calendar
        onValueChange={vi.fn()}
        onVisibleMonthChange={onVisibleMonthChange}
        value="2026-07-15"
        visibleMonth="2026-07-01"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '下个月' }))
    expect(onVisibleMonthChange).toHaveBeenCalledWith('2026-08-01')
    expect(screen.getByRole('button', { name: '选择月份' })).toHaveTextContent('7 月')

    rerender(
      <Calendar
        onValueChange={vi.fn()}
        onVisibleMonthChange={onVisibleMonthChange}
        value="2026-07-15"
        visibleMonth="2026-08-01"
      />,
    )
    expect(screen.getByRole('button', { name: '选择月份' })).toHaveTextContent('8 月')
  })

  it('offers a today action that selects today and returns to its month', async () => {
    const today = new Date()
    const todayValue = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    const todayMonth = `${todayValue.slice(0, 7)}-01`
    const onValueChange = vi.fn()
    const onVisibleMonthChange = vi.fn()

    render(
      <Calendar
        onValueChange={onValueChange}
        onVisibleMonthChange={onVisibleMonthChange}
        showTodayAction
        todayActionLabel="回到今天"
        value="2025-01-10"
        variant="tertiary"
        visibleMonth="2025-01-01"
      />,
    )

    const todayAction = screen.getByRole('button', { name: '回到今天' })
    expect(todayAction).toHaveClass('ods-button')
    expect(todayAction).toHaveAttribute('data-size', 'sm')
    expect(todayAction).toHaveAttribute('data-variant', 'outline')
    expect(todayAction.closest('.ods-calendar')).toHaveAttribute('data-variant', 'tertiary')

    await userEvent.click(todayAction)
    expect(onVisibleMonthChange).toHaveBeenCalledWith(todayMonth)
    expect(onValueChange).toHaveBeenCalledWith(todayValue)
  })

  it.each([
    ['max', { max: dayjs().subtract(1, 'day').format('YYYY-MM-DD') }],
    ['min', { min: dayjs().add(1, 'day').format('YYYY-MM-DD') }],
  ])('disables the today action when today violates %s', async (_boundary, range) => {
    const onValueChange = vi.fn()
    render(<Calendar {...range} onValueChange={onValueChange} showTodayAction />)

    const todayAction = screen.getByRole('button', { name: '今天' })
    expect(todayAction).toBeDisabled()
    await userEvent.click(todayAction)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('uses an ARIA grid with one roving day and supports calendar keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    const grid = screen.getByRole('grid', { name: '2026年7月' })
    expect(within(grid).getAllByRole('row')).toHaveLength(6)
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(42)
    expect(grid.querySelectorAll('button[tabindex="0"]')).toHaveLength(1)

    // Dates already have unique accessible labels; avoid a full computed-style
    // scan through all 42 buttons after every keyboard step on slower runners.
    const dayButton = (date: RegExp) => {
      const button = screen.getByLabelText(date)
      expect(button).toHaveRole('button')
      return button
    }
    const selectedDay = dayButton(/2026年7月15日/)
    expect(selectedDay).toHaveAttribute('tabindex', '0')
    expect(selectedDay.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true')
    selectedDay.focus()

    await user.keyboard('{ArrowRight}')
    expect(dayButton(/2026年7月16日/)).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(selectedDay).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(dayButton(/2026年7月22日/)).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(selectedDay).toHaveFocus()
    await user.keyboard('{Home}')
    expect(dayButton(/2026年7月13日/)).toHaveFocus()
    await user.keyboard('{End}')
    expect(dayButton(/2026年7月19日/)).toHaveFocus()
    await user.keyboard('{PageDown}')
    expect(dayButton(/2026年8月19日/)).toHaveFocus()
    await user.keyboard('{PageUp}')
    expect(dayButton(/2026年7月19日/)).toHaveFocus()
    expect(document.querySelectorAll('.ods-calendar__grid button[tabindex="0"]')).toHaveLength(1)
  }, 30_000)

  it('marks dates and lets consumers provide a contextual accessible label', () => {
    render(
      <Calendar
        getDateAriaLabel={(date, state) => `${date}${state.isMarked ? '，有事件' : ''}`}
        isDateMarked={(date) => date === '2026-07-20'}
        onValueChange={vi.fn()}
        value="2026-07-15"
        visibleMonth="2026-07-01"
      />,
    )

    const markedDate = screen.getByRole('button', { name: '2026-07-20，有事件' })
    expect(markedDate).toHaveAttribute('data-marked', 'true')
    expect(markedDate.querySelector('.ods-calendar__marker')).toBeInTheDocument()
    expect(markedDate.closest('.ods-calendar')).toHaveAttribute('data-layout', 'compact')
  })

  it('colors marks by tone and marks toned dates without isDateMarked', () => {
    render(
      <Calendar
        getDateTone={(date) => (date === '2026-07-21' ? 'danger' : undefined)}
        onValueChange={vi.fn()}
        value="2026-07-15"
        visibleMonth="2026-07-01"
      />,
    )

    const tonedDate = screen.getByRole('button', { name: /2026年7月21日/ })
    expect(tonedDate).toHaveAttribute('data-marked', 'true')
    expect(tonedDate.querySelector('.ods-calendar__marker')).toHaveAttribute('data-tone', 'danger')
    expect(
      screen.getByRole('button', { name: /2026年7月22日/ }).querySelector('.ods-calendar__marker'),
    ).not.toBeInTheDocument()
  })

  it('lays a board out from Sunday with only the weeks and days of the visible month', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const onVisibleMonthChange = vi.fn()
    render(
      <Calendar
        layout="board"
        onValueChange={onValueChange}
        onVisibleMonthChange={onVisibleMonthChange}
        renderDayContent={(date) => (date === '2026-11-13' ? <span>待收 ¥2,400</span> : null)}
        showTodayAction
        todayActionLabel="本月"
        value="2026-11-13"
        visibleMonth="2026-11-01"
        weekStartsOn={0}
      />,
    )

    const calendar = document.querySelector('.ods-calendar')!
    expect(calendar).toHaveAttribute('data-layout', 'board')
    expect(
      [...calendar.querySelectorAll('.ods-calendar__weekday')].map((node) => node.textContent),
    ).toEqual(['日', '一', '二', '三', '四', '五', '六'])
    expect(screen.getByRole('button', { name: '选择年份' })).toHaveTextContent('2026年')
    expect(screen.getByRole('button', { name: '选择月份' })).toHaveTextContent('11月')

    // November 2026 starts on a Sunday: five weeks, the last five cells stay empty.
    const grid = screen.getByRole('grid', { name: '2026年11月' })
    expect(grid).toHaveAttribute('aria-rowcount', '5')
    expect(within(grid).getAllByRole('row')).toHaveLength(5)
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(35)
    expect(within(grid).getAllByRole('button')).toHaveLength(30)
    expect(grid.querySelectorAll('[role="gridcell"][data-outside="true"]')).toHaveLength(5)

    const selected = screen.getByRole('button', { name: /2026年11月13日，星期五/ })
    expect(selected).toHaveAttribute('data-selected', 'true')
    expect(within(selected).getByText('待收 ¥2,400')).toBeInTheDocument()
    expect(selected.querySelector('.ods-calendar__marker')).not.toBeInTheDocument()

    // The title leads; previous, today and next follow it as one group.
    const group = calendar.querySelector('.ods-calendar__nav-group')!
    expect(
      within(group as HTMLElement)
        .getAllByRole('button')
        .map((node) => node.getAttribute('aria-label') ?? node.textContent),
    ).toEqual(['上个月', '本月', '下个月'])
    expect(screen.getByRole('button', { name: '本月' })).toHaveAttribute('data-size', 'md')

    selected.focus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('button', { name: /2026年11月8日，星期日/ })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('button', { name: /2026年11月14日，星期六/ })).toHaveFocus()
  })

  it('gives a board six weeks when the month needs them', () => {
    render(
      <Calendar
        layout="board"
        onValueChange={vi.fn()}
        value="2026-08-15"
        visibleMonth="2026-08-01"
        weekStartsOn={0}
      />,
    )

    const grid = screen.getByRole('grid', { name: '2026年8月' })
    expect(within(grid).getAllByRole('row')).toHaveLength(6)
    expect(within(grid).getAllByRole('button')).toHaveLength(31)
  })
})
