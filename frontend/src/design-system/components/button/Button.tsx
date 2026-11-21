import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from 'react'
import { triggerButtonIconPulse, triggerButtonRipple } from './buttonMotion'
import { cancelMotionAnimations } from '../icon/iconMotion'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'outline'
  | 'ghost'
  | 'danger'
  /** No paint and no box of its own: wraps content that is itself the thing to press. */
  | 'bare'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonTone = 'neutral' | 'accent' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  autoHeight?: boolean
  fullWidth?: boolean
  pending?: boolean
  size?: ButtonSize
  tone?: ButtonTone
  variant?: ButtonVariant
}

const joinClasses = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(' ')

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    'aria-busy': ariaBusy,
    autoHeight = false,
    children,
    className,
    disabled,
    fullWidth = false,
    onClick,
    onPointerDown,
    pending = false,
    size = 'md',
    tone = 'neutral',
    type = 'button',
    variant = 'primary',
    ...props
  },
  forwardedRef,
) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const rippleRef = useRef<HTMLSpanElement | null>(null)
  const inactive = Boolean(disabled || pending)
  const interactiveSurface = variant !== 'bare'

  useEffect(() => {
    const button = buttonRef.current
    return () => cancelMotionAnimations(button, true)
  }, [])

  const setButtonRef = (node: HTMLButtonElement | null) => {
    buttonRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (!inactive && interactiveSurface && event.button === 0) {
      triggerButtonRipple(buttonRef.current, rippleRef.current, event.clientX, event.clientY)
    }
    onPointerDown?.(event)
  }

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (!inactive && interactiveSurface) {
      if (event.detail === 0) {
        triggerButtonRipple(buttonRef.current, rippleRef.current)
      }
      triggerButtonIconPulse(buttonRef.current)
    }
    onClick?.(event)
  }

  return (
    <button
      {...props}
      aria-busy={pending || ariaBusy || undefined}
      className={joinClasses('ods-button', className)}
      data-auto-height={autoHeight || undefined}
      data-full-width={fullWidth || undefined}
      data-pending={pending || undefined}
      data-size={size}
      data-slot="button"
      data-tone={tone}
      data-variant={variant}
      disabled={inactive}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      ref={setButtonRef}
      type={type}
    >
      {interactiveSurface ? (
        <span aria-hidden="true" className="ods-button__ripple" ref={rippleRef} />
      ) : null}
      {children}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonProps, 'aria-label' | 'children'> {
  children: ReactNode
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, className, label, ...props },
  ref,
) {
  return (
    <Button
      {...props}
      aria-label={label}
      className={joinClasses('ods-icon-button', className)}
      ref={ref}
    >
      <span className="ods-icon-button__icon" data-slot="icon">
        {children}
      </span>
    </Button>
  )
})
