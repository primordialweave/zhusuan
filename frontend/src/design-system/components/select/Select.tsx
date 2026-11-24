import {
  cloneElement,
  forwardRef,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { useFieldControlProps } from '../field/fieldContext'
import { JadeIcon } from '../icon'
import { Popover, usePopoverClose, usePopoverOpen } from '../popover'
import { Listbox } from '../listbox'

export type SelectSize = 'sm' | 'md' | 'lg'
export type SelectWidth = 'content' | 'default'

const SELECT_INITIAL_FOCUS = [
  '[role="option"][aria-selected="true"]:not([aria-disabled="true"])',
  '[role="option"][tabindex="0"]:not([aria-disabled="true"])',
  '[role="option"]:not([aria-disabled="true"])',
]
const FOCUSABLE =
  'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex],[contenteditable="true"]'

function SelectTrigger({
  children,
}: {
  children: ReactElement<ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }>
}) {
  const open = usePopoverOpen()
  return (
    <Popover.Trigger>
      {cloneElement(children, {
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            open()
          }
        },
      })}
    </Popover.Trigger>
  )
}

export interface SelectOption {
  description?: ReactNode
  disabled?: boolean
  label: ReactNode
  value: string
}

interface SelectOptionsProps {
  ariaLabel?: string
  onKeyDown?: (event: KeyboardEvent<HTMLUListElement>) => void
  onValueChange: (value: string) => void
  options: SelectOption[]
  value?: string
}

function SelectOptions({
  ariaLabel,
  onKeyDown,
  onValueChange,
  options,
  value,
}: SelectOptionsProps) {
  const close = usePopoverClose()

  return (
    <Listbox
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onSelect={(next) => {
        onValueChange(next)
        close()
      }}
      selectedValues={value ? [value] : []}
    >
      {options.map((option) => (
        <Listbox.Item
          description={option.description}
          disabled={option.disabled}
          key={option.value}
          value={option.value}
        >
          {option.label}
        </Listbox.Item>
      ))}
    </Listbox>
  )
}

export interface SelectProps {
  'aria-label'?: string
  'aria-describedby'?: string
  className?: string
  clearable?: boolean
  disabled?: boolean
  invalid?: boolean
  id?: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  size?: SelectSize
  value?: string
  width?: SelectWidth
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    className,
    clearable = true,
    disabled = false,
    invalid = false,
    id,
    onValueChange,
    options,
    placeholder = '请选择',
    required = false,
    size = 'md',
    value,
    width = 'default',
  },
  ref,
) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value])
  const controlProps = useFieldControlProps({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': invalid,
    disabled,
    id,
    required,
  })
  const canClear = clearable && Boolean(selected?.value) && !controlProps.disabled && !open

  if (open && controlProps.disabled) setOpen(false)

  const clearSelection = () => {
    onValueChange('')
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'Tab') return
    const trigger = triggerRef.current
    const root = trigger?.closest('.ods-select-root')
    const scope = trigger?.closest('dialog, [role="dialog"]') ?? document
    const focusable = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => {
        const editable =
          element.getAttribute('contenteditable') === 'true' && !element.hasAttribute('tabindex')
        if (
          (element.tabIndex < 0 && !editable) ||
          element.matches(':disabled') ||
          element.closest('[hidden], [inert], [aria-hidden="true"]')
        ) {
          return false
        }
        if (
          event.currentTarget.contains(element) ||
          (root?.contains(element) && element !== trigger)
        ) {
          return false
        }
        for (
          let ancestor: HTMLElement | null = element;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor)
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.visibility === 'collapse'
          ) {
            return false
          }
        }
        return true
      },
    )
    const index = trigger ? focusable.indexOf(trigger) : -1
    const target = index < 0 ? undefined : focusable[index + (event.shiftKey ? -1 : 1)]
    setOpen(false)
    if (target) {
      event.preventDefault()
      event.stopPropagation()
      target.focus()
    } else {
      trigger?.focus()
    }
  }

  return (
    <Popover.Root
      className={['ods-select-root', className].filter(Boolean).join(' ')}
      onOpenChange={setOpen}
      open={open && !controlProps.disabled}
      placement="bottom-start"
    >
      <SelectTrigger>
        <button
          aria-label={ariaLabel}
          aria-describedby={controlProps['aria-describedby']}
          aria-haspopup="listbox"
          aria-invalid={controlProps['aria-invalid']}
          aria-required={controlProps.required || undefined}
          className="ods-select"
          data-clearable={canClear || undefined}
          data-invalid={controlProps['aria-invalid'] || undefined}
          data-size={size}
          data-slot="select"
          data-width={width}
          disabled={controlProps.disabled}
          id={controlProps.id}
          ref={(node) => {
            triggerRef.current = node
            if (typeof ref === 'function') return ref(node)
            if (ref) ref.current = node
          }}
          type="button"
        >
          <span className="ods-select__value" data-placeholder={selected ? undefined : ''}>
            {selected ? selected.label : placeholder}
          </span>
          <span aria-hidden="true" className="ods-select__caret" data-open={open || undefined}>
            <JadeIcon name="chevron-down" size="1em" />
          </span>
        </button>
      </SelectTrigger>
      {canClear ? (
        <button
          aria-label={`清除${ariaLabel || '选中项'}`}
          className="ods-select__clear"
          onClick={clearSelection}
          type="button"
        >
          <JadeIcon name="close" size="1em" />
        </button>
      ) : null}
      <Popover.Content
        className="ods-select__popover"
        data-width={width}
        initialFocus={SELECT_INITIAL_FOCUS}
        role="presentation"
      >
        <SelectOptions
          ariaLabel={ariaLabel}
          onKeyDown={handleListKeyDown}
          onValueChange={onValueChange}
          options={options}
          value={value}
        />
      </Popover.Content>
    </Popover.Root>
  )
})
