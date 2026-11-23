import {
  cloneElement,
  forwardRef,
  Fragment,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type Ref,
} from 'react'
import { useFieldControlProps } from '../field/fieldContext'
import { JadeIcon } from '../icon'
import { Listbox } from '../listbox'
import { Popover, usePopoverOpen } from '../popover'
import type { SelectOption, SelectSize, SelectWidth } from '../select'

const INITIAL_FOCUS = [
  '[role="option"][aria-selected="true"]:not([aria-disabled="true"])',
  '[role="option"][tabindex="0"]:not([aria-disabled="true"])',
  '[role="option"]:not([aria-disabled="true"])',
]
const EMPTY_VALUES: string[] = []
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex],[contenteditable="true"]'

export interface MultiSelectProps {
  'aria-label'?: string
  'aria-describedby'?: string
  className?: string
  clearable?: boolean
  disabled?: boolean
  invalid?: boolean
  id?: string
  onValueChange: (values: string[]) => void
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  size?: SelectSize
  value?: string[]
  width?: SelectWidth
}

function MultiSelectTrigger({
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

export const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(function MultiSelect(
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
    value = EMPTY_VALUES,
    width = 'default',
  },
  ref,
) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const selectionId = useId()
  const typeaheadRef = useRef({ text: '', time: 0 })
  const selected = options.filter((option) => value.includes(option.value))
  const controlProps = useFieldControlProps({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': invalid,
    disabled,
    id,
    required,
  })
  const canClear = clearable && value.length > 0 && !controlProps.disabled && !open

  // A temporarily disabled control must not reopen an old menu when enabled again.
  if (open && controlProps.disabled) setOpen(false)

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Tab') {
      const trigger = triggerRef.current
      const root = trigger?.closest('.ods-multi-select-root')
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
      return
    }

    if (
      event.defaultPrevented ||
      event.key.length !== 1 ||
      event.key === ' ' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }
    const time = Date.now()
    const previous = typeaheadRef.current
    const text = `${time - previous.time <= 500 ? previous.text : ''}${event.key.toLocaleLowerCase()}`
    typeaheadRef.current = { text, time }
    const prefix = Array.from(text).every((character) => character === text[0]) ? text[0] : text
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      ),
    )
    const current = items.indexOf(document.activeElement as HTMLElement)
    const offset = prefix.length === 1 ? 1 : 0
    const ordered = [...items.slice(current + offset), ...items.slice(0, current + offset)]
    const match = ordered.find((item) =>
      item
        .querySelector('.ods-listbox__label')
        ?.textContent?.trim()
        .toLocaleLowerCase()
        .startsWith(prefix),
    )
    if (match) {
      event.preventDefault()
      match.focus()
    }
  }

  return (
    <Popover.Root
      className={['ods-select-root', 'ods-multi-select-root', className].filter(Boolean).join(' ')}
      onOpenChange={(next) => {
        typeaheadRef.current = { text: '', time: 0 }
        setOpen(next)
      }}
      open={open && !controlProps.disabled}
      placement="bottom-start"
    >
      <MultiSelectTrigger>
        <button
          aria-label={ariaLabel}
          aria-describedby={[controlProps['aria-describedby'], selectionId]
            .filter(Boolean)
            .join(' ')}
          aria-haspopup="listbox"
          aria-invalid={controlProps['aria-invalid']}
          aria-required={controlProps.required || undefined}
          className="ods-select ods-multi-select"
          data-clearable={canClear || undefined}
          data-invalid={controlProps['aria-invalid'] || undefined}
          data-size={size}
          data-slot="multi-select"
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
          <span className="ods-select__value" data-placeholder={selected.length ? undefined : ''}>
            {selected.length ? selected[0].label : placeholder}
          </span>
          {selected.length > 1 ? (
            <span aria-hidden="true" className="ods-multi-select__count">
              +{selected.length - 1}
            </span>
          ) : null}
          <span aria-hidden="true" className="ods-select__caret" data-open={open || undefined}>
            <JadeIcon name="chevron-down" size="1em" />
          </span>
        </button>
      </MultiSelectTrigger>
      <span className="ods-sr-only" id={selectionId}>
        {selected.length ? (
          <>
            已选 {selected.length} 项：
            {selected.map((option, index) => (
              <Fragment key={option.value}>
                {index ? '、' : ''}
                {option.label}
              </Fragment>
            ))}
          </>
        ) : (
          placeholder
        )}
      </span>
      {canClear ? (
        <button
          aria-label={`清除${ariaLabel || '选中项'}`}
          className="ods-select__clear"
          onClick={() => {
            onValueChange([])
            setOpen(false)
            triggerRef.current?.focus()
          }}
          type="button"
        >
          <JadeIcon name="close" size="1em" />
        </button>
      ) : null}
      <Popover.Content
        className="ods-select__popover ods-multi-select__popover"
        data-width={width}
        initialFocus={INITIAL_FOCUS}
        role="presentation"
      >
        <Listbox
          aria-label={ariaLabel}
          onKeyDown={handleListKeyDown}
          onSelect={(next) => {
            onValueChange(
              value.includes(next) ? value.filter((item) => item !== next) : [...value, next],
            )
          }}
          selectedValues={value}
          selectionMode="multiple"
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
      </Popover.Content>
    </Popover.Root>
  )
})
