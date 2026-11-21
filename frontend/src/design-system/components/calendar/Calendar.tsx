import dayjs, { type Dayjs } from 'dayjs'
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react'
import { Button, IconButton } from '../button'
import { JadeIcon } from '../icon'

export type CalendarLayout = 'board' | 'compact'
export type CalendarWeekStart = 0 | 1
export type CalendarMarkTone = 'accent' | 'success' | 'warning' | 'danger'
export type CalendarVariant = 'secondary' | 'tertiary'

export interface CalendarDayState {
  isDisabled: boolean
  isMarked: boolean
  isOutsideMonth: boolean
  isSelected: boolean
  isToday: boolean
}

export interface CalendarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  getDateAriaLabel?: (date: string, state: CalendarDayState) => string
  getDateTone?: (date: string) => CalendarMarkTone | undefined
  isDateMarked?: (date: string) => boolean
  layout?: CalendarLayout
  max?: string
  min?: string
  onValueChange: (value: string) => void
  onVisibleMonthChange?: (value: string) => void
  renderDayContent?: (date: string, state: CalendarDayState) => ReactNode
  showTodayAction?: boolean
  todayActionLabel?: string
  value?: string
  variant?: CalendarVariant
  visibleMonth?: string
  weekStartsOn?: CalendarWeekStart
}

type CalendarView = 'days' | 'months' | 'years'

// Indexed by dayjs day(): 0 = Sunday.
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
]
const ISO_FORMAT = 'YYYY-MM-DD'
const YEARS_PER_PAGE = 12

const columnIndex = (date: Dayjs, weekStartsOn: CalendarWeekStart) =>
  (date.day() - weekStartsOn + 7) % 7

const buildGrid = (visibleMonth: Dayjs, weekStartsOn: CalendarWeekStart, fixedRows: boolean) => {
  const firstOfMonth = visibleMonth.startOf('month')
  const leading = columnIndex(firstOfMonth, weekStartsOn)
  const weekCount = fixedRows ? 6 : Math.ceil((leading + visibleMonth.daysInMonth()) / 7)
  const gridStart = firstOfMonth.subtract(leading, 'day')
  return Array.from({ length: weekCount * 7 }, (_, index) => gridStart.add(index, 'day'))
}

const normalizeMonth = (value: string | undefined, fallback: Dayjs) => {
  const candidate = value ? dayjs(value) : fallback
  return (candidate.isValid() ? candidate : fallback).startOf('month')
}

const assignRef = <T,>(ref: Ref<T> | undefined, node: T | null) => {
  if (typeof ref === 'function') ref(node)
  else if (ref) (ref as MutableRefObject<T | null>).current = node
}

const getDefaultDateAriaLabel = (date: Dayjs) =>
  `${date.year()}年${date.month() + 1}月${date.date()}日，星期${WEEKDAY_NAMES[date.day()]}`

export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  {
    className,
    getDateAriaLabel,
    getDateTone,
    isDateMarked,
    layout = 'compact',
    max,
    min,
    onValueChange,
    onVisibleMonthChange,
    renderDayContent,
    showTodayAction = false,
    todayActionLabel = '今天',
    value,
    variant = 'secondary',
    visibleMonth: controlledVisibleMonth,
    weekStartsOn = 1,
    ...props
  },
  ref,
) {
  const selectedCandidate = value ? dayjs(value) : null
  const selected = selectedCandidate?.isValid() ? selectedCandidate : null
  const [uncontrolledVisibleMonth, setUncontrolledVisibleMonth] = useState<Dayjs>(() =>
    normalizeMonth(undefined, selected ?? dayjs()),
  )
  const visibleMonth = normalizeMonth(controlledVisibleMonth, uncontrolledVisibleMonth)
  const [view, setView] = useState<CalendarView>('days')
  const [activeDate, setActiveDate] = useState<string | null>(
    () => selected?.format(ISO_FORMAT) ?? null,
  )
  const calendarRef = useRef<HTMLDivElement | null>(null)
  const pendingFocusDateRef = useRef<string | null>(null)

  const minDate = min ? dayjs(min) : null
  const maxDate = max ? dayjs(max) : null
  // A board shows only the visible month: no adjacent-month days, only the weeks it needs.
  const isBoard = layout === 'board'
  const days = buildGrid(visibleMonth, weekStartsOn, !isBoard)
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  )
  const weekdays = Array.from(
    { length: 7 },
    (_, index) => WEEKDAY_NAMES[(index + weekStartsOn) % 7],
  )
  const yearPageStart = Math.floor(visibleMonth.year() / YEARS_PER_PAGE) * YEARS_PER_PAGE
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, index) => yearPageStart + index)

  const isDisabled = (day: Dayjs) =>
    (minDate ? day.isBefore(minDate, 'day') : false) ||
    (maxDate ? day.isAfter(maxDate, 'day') : false)

  const updateVisibleMonth = (nextMonth: Dayjs) => {
    const normalized = nextMonth.startOf('month')
    setActiveDate(normalized.format(ISO_FORMAT))
    if (controlledVisibleMonth === undefined) setUncontrolledVisibleMonth(normalized)
    onVisibleMonthChange?.(normalized.format(ISO_FORMAT))
  }

  const navigate = (direction: 1 | -1) => {
    if (view === 'days') updateVisibleMonth(visibleMonth.add(direction, 'month'))
    else if (view === 'months') updateVisibleMonth(visibleMonth.add(direction, 'year'))
    else updateVisibleMonth(visibleMonth.add(direction * YEARS_PER_PAGE, 'year'))
  }

  const selectToday = () => {
    const today = dayjs()
    if (isDisabled(today)) return
    updateVisibleMonth(today)
    setActiveDate(today.format(ISO_FORMAT))
    setView('days')
    onValueChange(today.format(ISO_FORMAT))
  }

  const enabledDays = days.filter(
    (day) => !isDisabled(day) && (!isBoard || day.isSame(visibleMonth, 'month')),
  )
  const findEnabledDate = (date: string | null | undefined) => {
    if (!date) return undefined
    return enabledDays.find(
      (day) => day.format(ISO_FORMAT) === date && day.isSame(visibleMonth, 'month'),
    )
  }
  const tabStopDay =
    findEnabledDate(activeDate) ??
    findEnabledDate(selected?.format(ISO_FORMAT)) ??
    findEnabledDate(dayjs().format(ISO_FORMAT)) ??
    enabledDays.find((day) => day.isSame(visibleMonth, 'month')) ??
    enabledDays[0]
  const tabStopDate = tabStopDay?.format(ISO_FORMAT)
  const todayDisabled = isDisabled(dayjs())

  useLayoutEffect(() => {
    const pendingDate = pendingFocusDateRef.current
    if (!pendingDate) return

    const target = calendarRef.current?.querySelector<HTMLButtonElement>(
      `[data-date="${pendingDate}"]`,
    )
    if (!target || target.disabled) return

    pendingFocusDateRef.current = null
    target.focus()
  })

  const focusDay = (nextDay: Dayjs) => {
    if (isDisabled(nextDay)) return

    const date = nextDay.format(ISO_FORMAT)
    pendingFocusDateRef.current = date
    if (!nextDay.isSame(visibleMonth, 'month')) updateVisibleMonth(nextDay)
    setActiveDate(date)
  }

  const findNextEnabledDay = (start: Dayjs, step: number) => {
    let candidate = start
    for (let index = 0; index < 42; index += 1) {
      if (!isDisabled(candidate)) return candidate
      candidate = candidate.add(step, 'day')
    }
    return null
  }

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, day: Dayjs) => {
    let nextDay: Dayjs | null

    if (event.key === 'ArrowLeft') nextDay = findNextEnabledDay(day.subtract(1, 'day'), -1)
    else if (event.key === 'ArrowRight') nextDay = findNextEnabledDay(day.add(1, 'day'), 1)
    else if (event.key === 'ArrowUp') nextDay = findNextEnabledDay(day.subtract(7, 'day'), -7)
    else if (event.key === 'ArrowDown') nextDay = findNextEnabledDay(day.add(7, 'day'), 7)
    else if (event.key === 'Home') {
      const weekStart = day.subtract(columnIndex(day, weekStartsOn), 'day')
      nextDay =
        Array.from({ length: 7 }, (_, index) => weekStart.add(index, 'day')).find(
          (candidate) => !isDisabled(candidate),
        ) ?? null
    } else if (event.key === 'End') {
      const weekEnd = day.add(6 - columnIndex(day, weekStartsOn), 'day')
      nextDay =
        Array.from({ length: 7 }, (_, index) => weekEnd.subtract(index, 'day')).find(
          (candidate) => !isDisabled(candidate),
        ) ?? null
    } else if (event.key === 'PageUp') {
      nextDay = day.subtract(1, event.shiftKey ? 'year' : 'month')
    } else if (event.key === 'PageDown') {
      nextDay = day.add(1, event.shiftKey ? 'year' : 'month')
    } else {
      return
    }

    event.preventDefault()
    if (nextDay) focusDay(nextDay)
  }

  const yearLabel = isBoard ? `${visibleMonth.year()}年` : `${visibleMonth.year()} 年`
  const monthLabel = isBoard ? `${visibleMonth.month() + 1}月` : `${visibleMonth.month() + 1} 月`
  const title = (
    <span aria-live="polite" className="ods-calendar__title">
      <button
        aria-label="选择年份"
        className="ods-calendar__title-button"
        data-active={view === 'years' || undefined}
        onClick={() => setView(view === 'years' ? 'days' : 'years')}
        type="button"
      >
        {view === 'years' ? `${yearPageStart} – ${yearPageStart + YEARS_PER_PAGE - 1}` : yearLabel}
      </button>
      {view === 'days' ? (
        <button
          aria-label="选择月份"
          className="ods-calendar__title-button"
          onClick={() => setView('months')}
          type="button"
        >
          {monthLabel}
        </button>
      ) : null}
    </span>
  )
  const previousButton = (
    <IconButton
      className="ods-calendar__nav"
      label={view === 'days' ? '上个月' : view === 'months' ? '上一年' : '前 12 年'}
      onClick={() => navigate(-1)}
      size={isBoard ? 'md' : 'sm'}
      variant={isBoard ? 'outline' : 'ghost'}
    >
      <JadeIcon name="chevron-left" size="1em" />
    </IconButton>
  )
  const nextButton = (
    <IconButton
      className="ods-calendar__nav"
      label={view === 'days' ? '下个月' : view === 'months' ? '下一年' : '后 12 年'}
      onClick={() => navigate(1)}
      size={isBoard ? 'md' : 'sm'}
      variant={isBoard ? 'outline' : 'ghost'}
    >
      <JadeIcon name="chevron-right" size="1em" />
    </IconButton>
  )
  const todayButton = showTodayAction ? (
    <Button
      className="ods-calendar__today"
      disabled={todayDisabled}
      onClick={selectToday}
      size={isBoard ? 'md' : 'sm'}
      variant="outline"
    >
      {todayActionLabel}
    </Button>
  ) : null

  return (
    <div
      {...props}
      className={['ods-calendar', className].filter(Boolean).join(' ')}
      data-layout={layout}
      data-slot="calendar"
      data-variant={variant}
      data-view={view}
      ref={(node) => {
        calendarRef.current = node
        assignRef(ref, node)
      }}
    >
      <div className="ods-calendar__header">
        {isBoard ? (
          <>
            {title}
            <div className="ods-calendar__nav-group">
              {previousButton}
              {todayButton}
              {nextButton}
            </div>
          </>
        ) : (
          <>
            {previousButton}
            {title}
            {todayButton}
            {nextButton}
          </>
        )}
      </div>

      {view === 'days' ? (
        <>
          <div aria-hidden="true" className="ods-calendar__weekdays">
            {weekdays.map((weekday) => (
              <span className="ods-calendar__weekday" key={weekday}>
                {weekday}
              </span>
            ))}
          </div>
          <div
            aria-colcount={7}
            aria-label={`${visibleMonth.year()}年${visibleMonth.month() + 1}月`}
            aria-rowcount={weeks.length}
            className="ods-calendar__grid"
            role="grid"
          >
            {weeks.map((week) => (
              <div className="ods-calendar__week" key={week[0].format(ISO_FORMAT)} role="row">
                {week.map((day) => {
                  const date = day.format(ISO_FORMAT)
                  const outside = !day.isSame(visibleMonth, 'month')
                  if (outside && isBoard) {
                    return (
                      <div
                        className="ods-calendar__cell"
                        data-outside="true"
                        key={date}
                        role="gridcell"
                      />
                    )
                  }
                  const isSelected = selected ? day.isSame(selected, 'day') : false
                  const isToday = day.isSame(dayjs(), 'day')
                  const disabled = isDisabled(day)
                  const markTone = getDateTone?.(date)
                  const isMarked = (isDateMarked?.(date) ?? false) || markTone !== undefined
                  const state: CalendarDayState = {
                    isDisabled: disabled,
                    isMarked,
                    isOutsideMonth: outside,
                    isSelected,
                    isToday,
                  }
                  return (
                    <div
                      aria-selected={isSelected}
                      className="ods-calendar__cell"
                      key={date}
                      role="gridcell"
                    >
                      <button
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={getDateAriaLabel?.(date, state) ?? getDefaultDateAriaLabel(day)}
                        className="ods-calendar__day"
                        data-date={date}
                        data-marked={isMarked || undefined}
                        data-outside={outside || undefined}
                        data-selected={isSelected || undefined}
                        data-today={isToday || undefined}
                        disabled={disabled}
                        onClick={() => {
                          if (outside) updateVisibleMonth(day)
                          setActiveDate(date)
                          onValueChange(date)
                        }}
                        onFocus={() => setActiveDate(date)}
                        onKeyDown={(event) => handleDayKeyDown(event, day)}
                        tabIndex={!disabled && date === tabStopDate ? 0 : -1}
                        type="button"
                      >
                        <span className="ods-calendar__day-number">{day.date()}</span>
                        {renderDayContent ? (
                          <span className="ods-calendar__day-content" data-slot="day-content">
                            {renderDayContent(date, state)}
                          </span>
                        ) : null}
                        {isMarked && !renderDayContent ? (
                          <span
                            aria-hidden="true"
                            className="ods-calendar__marker"
                            data-slot="marker"
                            data-tone={markTone}
                          />
                        ) : null}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {view === 'months' ? (
        <div className="ods-calendar__picker-grid">
          {MONTHS.map((label, index) => {
            const isCurrent = visibleMonth.month() === index
            return (
              <button
                className="ods-calendar__picker-cell"
                data-selected={isCurrent || undefined}
                key={label}
                onClick={() => {
                  updateVisibleMonth(visibleMonth.month(index))
                  setView('days')
                }}
                type="button"
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : null}

      {view === 'years' ? (
        <div className="ods-calendar__picker-grid">
          {years.map((year) => {
            const isCurrent = visibleMonth.year() === year
            return (
              <button
                className="ods-calendar__picker-cell"
                data-selected={isCurrent || undefined}
                key={year}
                onClick={() => {
                  updateVisibleMonth(visibleMonth.year(year))
                  setView('months')
                }}
                type="button"
              >
                {year}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
