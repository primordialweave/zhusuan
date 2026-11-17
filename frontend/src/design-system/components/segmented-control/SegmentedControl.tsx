import { useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'

export interface SegmentedControlOption<T extends string = string> {
  label: ReactNode
  value: T
}

export type SegmentedControlSize = 'sm' | 'md'

export interface SegmentedControlProps<T extends string = string> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  'aria-label': string
  disabled?: boolean
  onValueChange: (value: T) => void
  options: ReadonlyArray<SegmentedControlOption<T>>
  size?: SegmentedControlSize
  value: T
}

/** A single-choice switcher for a few peer options, such as a period or a theme. */
export function SegmentedControl<T extends string = string>({
  className,
  disabled = false,
  onValueChange,
  options,
  size = 'md',
  value,
  ...props
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null)

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : step === 0
            ? null
            : (index + step + options.length) % options.length
    if (target === null) return

    event.preventDefault()
    onValueChange(options[target].value)
    const items = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    items?.[target]?.focus()
  }

  return (
    <div
      {...props}
      aria-disabled={disabled || undefined}
      className={['ods-segmented-control', className].filter(Boolean).join(' ')}
      data-size={size}
      data-slot="segmented-control"
      ref={groupRef}
      role="radiogroup"
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            aria-checked={selected}
            className="ods-segmented-control__item"
            data-slot="item"
            disabled={disabled}
            key={option.value}
            onClick={() => {
              if (!selected) onValueChange(option.value)
            }}
            onKeyDown={(event) => move(event, index)}
            role="radio"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
