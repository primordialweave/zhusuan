import {
  cloneElement,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import {
  isElementInOverlayLayerSubtree,
  isTopOverlayLayer,
  OverlayLayerProvider,
  setOverlayLayerElement,
  useOverlayLayer,
  type OverlayLayerToken,
} from '@/hooks/overlayStack'

const assignRef = <T,>(ref: Ref<T> | undefined, node: T | null) => {
  if (typeof ref === 'function') ref(node)
  else if (ref) (ref as MutableRefObject<T | null>).current = node
}

const TABBABLE_SELECTOR =
  'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]'

function tabTarget(trigger: HTMLElement, content: HTMLElement, shift: boolean) {
  const root = trigger.closest('.ods-popover-root')
  const dialog = trigger.closest('dialog, [role="dialog"], [role="alertdialog"]')
  const scope = dialog ?? trigger.ownerDocument
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (element) => {
      const editable =
        element.getAttribute('contenteditable') === 'true' && !element.hasAttribute('tabindex')
      if (
        (element.tabIndex < 0 && !editable) ||
        element.matches(':disabled') ||
        element.closest('[hidden], [inert], [aria-hidden="true"]') ||
        content.contains(element) ||
        (root?.contains(element) && element !== trigger)
      ) {
        return false
      }
      for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
        const { display, visibility } = getComputedStyle(ancestor)
        if (display === 'none' || visibility === 'hidden' || visibility === 'collapse') return false
      }
      return true
    },
  )
  // Positive tabindex values precede controls with tabindex=0 or implicit tab order.
  const ordered = candidates.sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity))
  const index = ordered.indexOf(trigger)
  if (index === -1) return undefined
  return ordered[index + (shift ? -1 : 1)] ?? (dialog ? ordered.at(shift ? -1 : 0) : undefined)
}

export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
export type PopoverPadding = 'none' | 'sm' | 'md'

interface PopoverContextValue {
  close: () => void
  dismiss: () => void
  contentId: string
  getTrigger: () => HTMLElement | null
  layerToken: OverlayLayerToken
  layerZIndex: CSSProperties['zIndex']
  open: boolean
  openPopover: () => void
  placement: PopoverPlacement
  setContent: (node: HTMLElement | null) => void
  setTrigger: (node: HTMLElement | null) => void
  toggle: () => void
  triggerId: string
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

const usePopoverContext = () => {
  const context = useContext(PopoverContext)
  if (!context) throw new Error('Popover subcomponents must be used inside Popover.Root')
  return context
}

export interface PopoverRootProps {
  children: ReactNode
  className?: string
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  open?: boolean
  placement?: PopoverPlacement
}

export function PopoverRoot({
  children,
  className,
  defaultOpen = false,
  onOpenChange,
  open: controlledOpen,
  placement = 'bottom-start',
}: PopoverRootProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const triggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const baseId = useId().replaceAll(':', '')
  const { token: layerToken, zIndex: layerZIndex } = useOverlayLayer({
    kind: 'popover',
    open,
  })

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [controlledOpen, onOpenChange],
  )

  const context: PopoverContextValue = {
    close: () => {
      setOpen(false)
      queueMicrotask(() => triggerRef.current?.focus())
    },
    dismiss: () => setOpen(false),
    contentId: `${baseId}-content`,
    getTrigger: () => triggerRef.current,
    layerToken,
    layerZIndex,
    open,
    openPopover: () => setOpen(true),
    placement,
    setContent: (node) => {
      contentRef.current = node
    },
    setTrigger: (node) => {
      triggerRef.current = node
    },
    toggle: () => setOpen(!open),
    triggerId: `${baseId}-trigger`,
  }

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        rootRef.current?.contains(target) ||
        contentRef.current?.contains(target) ||
        isElementInOverlayLayerSubtree(layerToken, target)
      ) {
        return
      }
      setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isTopOverlayLayer(layerToken)) return
      event.preventDefault()
      setOpen(false)
      queueMicrotask(() => triggerRef.current?.focus())
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [layerToken, open, setOpen])

  return (
    <OverlayLayerProvider value={layerToken}>
      <PopoverContext.Provider value={context}>
        <div className={['ods-popover-root', className].filter(Boolean).join(' ')} ref={rootRef}>
          {children}
        </div>
      </PopoverContext.Provider>
    </OverlayLayerProvider>
  )
}

export interface PopoverTriggerProps {
  children: ReactElement<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>
}

export function PopoverTrigger({ children }: PopoverTriggerProps) {
  const { contentId, open, setTrigger, toggle, triggerId } = usePopoverContext()
  const childProps = children.props

  return cloneElement(children, {
    'aria-controls': open ? contentId : undefined,
    'aria-expanded': open,
    'aria-haspopup': childProps['aria-haspopup'] ?? 'dialog',
    id: childProps.id ?? triggerId,
    onClick: (event) => {
      childProps.onClick?.(event)
      if (!event.defaultPrevented) toggle()
    },
    ref: (node: HTMLElement | null) => {
      setTrigger(node)
      assignRef(childProps.ref, node)
    },
  })
}

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  closeOnTab?: boolean
  initialFocus?: string | string[]
  padding?: PopoverPadding
  role?: string
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    {
      children,
      className,
      closeOnTab = false,
      initialFocus,
      onKeyDown,
      padding = 'sm',
      role = 'dialog',
      style,
      ...props
    },
    ref,
  ) {
    const {
      contentId,
      dismiss,
      getTrigger,
      layerToken,
      layerZIndex,
      open,
      placement,
      setContent,
      triggerId,
    } = usePopoverContext()
    const contentRef = useRef<HTMLDivElement | null>(null)
    const didInitialFocusRef = useRef(false)

    useLayoutEffect(() => {
      if (!open) return

      const updatePosition = () => {
        const trigger = getTrigger()
        const content = contentRef.current
        if (!trigger || !content) return

        const margin = 8
        const gap = 8
        const triggerRect = trigger.getBoundingClientRect()
        const viewport = window.visualViewport
        const viewportLeft = viewport?.offsetLeft ?? 0
        const viewportTop = viewport?.offsetTop ?? 0
        const viewportWidth = viewport?.width ?? window.innerWidth
        const viewportHeight = viewport?.height ?? window.innerHeight
        const viewportRight = viewportLeft + viewportWidth
        const viewportBottom = viewportTop + viewportHeight

        content.style.setProperty(
          '--popover-viewport-width',
          `${Math.max(0, viewportWidth - margin * 2)}px`,
        )
        content.style.setProperty(
          '--popover-viewport-height',
          `${Math.max(0, viewportHeight - margin * 2)}px`,
        )
        // Entrance transforms scale getBoundingClientRect; use the final layout box instead.
        const contentWidth = content.offsetWidth
        const contentHeight = content.offsetHeight
        const alignEnd = placement.endsWith('-end')
        const preferTop = placement.startsWith('top-')
        let left = alignEnd ? triggerRect.right - contentWidth : triggerRect.left
        let top = preferTop ? triggerRect.top - contentHeight - gap : triggerRect.bottom + gap
        let side = preferTop ? 'top' : 'bottom'

        if (!preferTop && top + contentHeight > viewportBottom - margin) {
          const flippedTop = triggerRect.top - contentHeight - gap
          if (flippedTop >= viewportTop + margin) {
            top = flippedTop
            side = 'top'
          }
        } else if (preferTop && top < viewportTop + margin) {
          const flippedBottom = triggerRect.bottom + gap
          if (flippedBottom + contentHeight <= viewportBottom - margin) {
            top = flippedBottom
            side = 'bottom'
          }
        }

        left = Math.max(
          viewportLeft + margin,
          Math.min(left, Math.max(viewportLeft + margin, viewportRight - contentWidth - margin)),
        )
        top = Math.max(
          viewportTop + margin,
          Math.min(top, Math.max(viewportTop + margin, viewportBottom - contentHeight - margin)),
        )

        content.style.left = `${left}px`
        content.style.top = `${top}px`
        content.dataset.side = side
        content.dataset.align = alignEnd ? 'end' : 'start'
      }

      updatePosition()
      const observer =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition)
      if (contentRef.current) observer?.observe(contentRef.current)
      const trigger = getTrigger()
      if (trigger) observer?.observe(trigger)
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      window.visualViewport?.addEventListener('resize', updatePosition)
      window.visualViewport?.addEventListener('scroll', updatePosition)
      return () => {
        observer?.disconnect()
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
        window.visualViewport?.removeEventListener('resize', updatePosition)
        window.visualViewport?.removeEventListener('scroll', updatePosition)
      }
    }, [getTrigger, open, placement])

    useLayoutEffect(() => {
      if (!open) {
        didInitialFocusRef.current = false
        return
      }
      if (!initialFocus || didInitialFocusRef.current) return

      const selectors = Array.isArray(initialFocus) ? initialFocus : [initialFocus]
      const focusTarget = selectors
        .map((selector) => contentRef.current?.querySelector<HTMLElement>(selector))
        .find((element): element is HTMLElement => Boolean(element))
      if (focusTarget) {
        didInitialFocusRef.current = true
        focusTarget.focus()
      }
    }, [initialFocus, open])

    if (!open || typeof document === 'undefined') return null

    const labelledBy = props['aria-label']
      ? undefined
      : (props['aria-labelledby'] ?? getTrigger()?.id ?? triggerId)

    return createPortal(
      <div
        {...props}
        aria-labelledby={labelledBy}
        className={['ods-popover', className].filter(Boolean).join(' ')}
        data-padding={padding}
        data-placement={placement}
        data-slot="popover"
        id={contentId}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (
            !closeOnTab ||
            event.defaultPrevented ||
            event.key !== 'Tab' ||
            !event.currentTarget.contains(event.target as Node)
          ) {
            return
          }
          const trigger = getTrigger()
          const target = trigger ? tabTarget(trigger, event.currentTarget, event.shiftKey) : undefined
          dismiss()
          if (target) {
            event.preventDefault()
            event.stopPropagation()
            target.focus()
          } else {
            // Let the browser continue from the trigger at an edge of the page tab order.
            trigger?.focus()
          }
        }}
        ref={(node) => {
          contentRef.current = node
          setContent(node)
          setOverlayLayerElement(layerToken, node)
          assignRef(ref, node)
        }}
        role={role}
        style={{ ...style, position: 'fixed', zIndex: layerZIndex }}
      >
        {children}
      </div>,
      document.body,
    )
  },
)

// Compound component namespaces are intentionally exported as a stable object.
// eslint-disable-next-line react-refresh/only-export-components
export const Popover = {
  Content: PopoverContent,
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
}

// A hook shares the same module so Dropdown can consume the root context without exposing it.
// eslint-disable-next-line react-refresh/only-export-components
export const usePopoverClose = () => usePopoverContext().close

// eslint-disable-next-line react-refresh/only-export-components
export const usePopoverOpen = () => usePopoverContext().openPopover
