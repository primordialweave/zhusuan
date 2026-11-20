import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export interface WindowControlButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  children: ReactNode
  label: string
  tone?: 'neutral' | 'danger'
}

/** A fixed window action target that stays still while the surrounding window moves. */
export const WindowControlButton = forwardRef<HTMLButtonElement, WindowControlButtonProps>(
  function WindowControlButton(
    { children, className, label, tone = 'neutral', type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        {...props}
        aria-label={label}
        className={['ods-window-control-button', className].filter(Boolean).join(' ')}
        data-slot="window-control-button"
        data-tone={tone}
        ref={ref}
        type={type}
      >
        {children}
      </button>
    )
  },
)
