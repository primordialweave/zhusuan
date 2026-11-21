import {
  forwardRef,
  useRef,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from 'react'
import {
  Link as ReactRouterLink,
  NavLink as ReactRouterNavLink,
  type LinkProps as ReactRouterLinkProps,
  type NavLinkRenderProps,
  type NavLinkProps as ReactRouterNavLinkProps,
} from 'react-router-dom'
import type { ButtonSize, ButtonTone, ButtonVariant } from '../../components/button'
import { triggerButtonIconPulse, triggerButtonRipple } from '../../components/button/buttonMotion'
import type { LinkTone, LinkUnderline } from '../../components/link'

export interface RouterButtonProps extends Omit<ReactRouterLinkProps, 'className'> {
  className?: string
  disabled?: boolean
  fullWidth?: boolean
  pending?: boolean
  size?: ButtonSize
  tone?: ButtonTone
  variant?: ButtonVariant
}

export const RouterButton = forwardRef<HTMLAnchorElement, RouterButtonProps>(function RouterButton(
  {
    'aria-busy': ariaBusy,
    children,
    className,
    disabled = false,
    fullWidth = false,
    onClick,
    onPointerDown,
    pending = false,
    size = 'md',
    tabIndex,
    tone = 'neutral',
    variant = 'primary',
    ...props
  },
  forwardedRef,
) {
  const linkRef = useRef<HTMLAnchorElement | null>(null)
  const rippleRef = useRef<HTMLSpanElement | null>(null)
  const inactive = disabled || pending
  const interactiveSurface = variant !== 'bare'

  const setLinkRef = (node: HTMLAnchorElement | null) => {
    linkRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  const handlePointerDown: PointerEventHandler<HTMLAnchorElement> = (event) => {
    if (!inactive && interactiveSurface && event.button === 0) {
      triggerButtonRipple(linkRef.current, rippleRef.current, event.clientX, event.clientY)
    }
    onPointerDown?.(event)
  }

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (inactive) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (interactiveSurface) {
      if (event.detail === 0) {
        triggerButtonRipple(linkRef.current, rippleRef.current)
      }
      triggerButtonIconPulse(linkRef.current)
    }
    onClick?.(event)
  }

  return (
    <ReactRouterLink
      {...props}
      aria-busy={pending || ariaBusy || undefined}
      aria-disabled={inactive || undefined}
      className={['ods-button', 'ods-router-button', className].filter(Boolean).join(' ')}
      data-full-width={fullWidth || undefined}
      data-pending={pending || undefined}
      data-size={size}
      data-tone={tone}
      data-variant={variant}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      ref={setLinkRef}
      tabIndex={inactive ? -1 : tabIndex}
    >
      {interactiveSurface ? (
        <span aria-hidden="true" className="ods-button__ripple" ref={rippleRef} />
      ) : null}
      {children}
    </ReactRouterLink>
  )
})

export interface RouterIconButtonProps extends Omit<RouterButtonProps, 'aria-label'> {
  label: string
}

export const RouterIconButton = forwardRef<HTMLAnchorElement, RouterIconButtonProps>(
  function RouterIconButton({ children, className, label, ...props }, ref) {
    return (
      <RouterButton
        {...props}
        aria-label={label}
        className={['ods-icon-button', className].filter(Boolean).join(' ')}
        ref={ref}
      >
        <span className="ods-icon-button__icon" data-slot="icon">
          {children}
        </span>
      </RouterButton>
    )
  },
)

export interface RouterLinkProps extends Omit<ReactRouterLinkProps, 'className'> {
  appearance?: 'link' | 'row'
  className?: string
  density?: 'compact' | 'comfortable'
  icon?: ReactNode
  tone?: LinkTone
  underline?: LinkUnderline
}

export const RouterLink = forwardRef<HTMLAnchorElement, RouterLinkProps>(function RouterLink(
  {
    appearance = 'link',
    children,
    className,
    density = 'compact',
    icon,
    tone,
    underline,
    ...props
  },
  ref,
) {
  const resolvedTone = tone ?? (appearance === 'row' ? 'foreground' : 'accent')
  const resolvedUnderline = underline ?? (appearance === 'row' ? 'none' : 'hover')

  return (
    <ReactRouterLink
      {...props}
      className={['ods-link', 'ods-router-link', className].filter(Boolean).join(' ')}
      data-appearance={appearance}
      data-density={density}
      data-tone={resolvedTone}
      data-underline={resolvedUnderline}
      ref={ref}
    >
      {children}
      {icon ? (
        <span aria-hidden="true" className="ods-link__icon" data-slot="icon">
          {icon}
        </span>
      ) : null}
    </ReactRouterLink>
  )
})

export interface RouterNavLinkProps extends Omit<ReactRouterNavLinkProps, 'className'> {
  /** Overrides path matching, for an entry that owns routes outside its own prefix. */
  active?: boolean
  appearance?: 'dock' | 'link' | 'tab'
  className?: ReactRouterNavLinkProps['className']
  icon?: ReactNode
  tone?: LinkTone
  underline?: LinkUnderline
}

const renderRouterNavLinkContent = (content: ReactNode, icon?: ReactNode) => (
  <>
    {icon ? (
      <span aria-hidden="true" className="ods-router-nav-link__icon" data-slot="icon">
        {icon}
      </span>
    ) : null}
    <span className="ods-router-nav-link__label" data-slot="label">
      {content}
    </span>
  </>
)

export const RouterNavLink = forwardRef<HTMLAnchorElement, RouterNavLinkProps>(
  function RouterNavLink(
    {
      active,
      appearance = 'link',
      caseSensitive,
      children,
      className,
      end,
      icon,
      style,
      tone = 'foreground',
      underline = 'none',
      ...props
    },
    ref,
  ) {
    const baseClasses = ['ods-link', 'ods-router-link', 'ods-router-nav-link']
    if (active !== undefined) {
      // The caller decides the match, so the path-matching options do not apply here.
      const state: NavLinkRenderProps = {
        isActive: active,
        isPending: false,
        isTransitioning: false,
      }
      return (
        <ReactRouterLink
          {...props}
          aria-current={active ? 'page' : undefined}
          className={[
            ...baseClasses,
            typeof className === 'function' ? className(state) : className,
          ]
            .filter(Boolean)
            .join(' ')}
          data-appearance={appearance}
          data-tone={tone}
          data-underline={underline}
          ref={ref}
          style={typeof style === 'function' ? style(state) : style}
        >
          {renderRouterNavLinkContent(
            typeof children === 'function' ? children(state) : children,
            icon,
          )}
        </ReactRouterLink>
      )
    }

    const resolvedClassName: ReactRouterNavLinkProps['className'] =
      typeof className === 'function'
        ? (state) => [...baseClasses, className(state)].filter(Boolean).join(' ')
        : [...baseClasses, className].filter(Boolean).join(' ')
    const resolvedChildren: ReactRouterNavLinkProps['children'] =
      typeof children === 'function'
        ? (state: NavLinkRenderProps) => renderRouterNavLinkContent(children(state), icon)
        : renderRouterNavLinkContent(children, icon)

    return (
      <ReactRouterNavLink
        {...props}
        caseSensitive={caseSensitive}
        className={resolvedClassName}
        data-appearance={appearance}
        data-tone={tone}
        data-underline={underline}
        end={end}
        ref={ref}
        style={style}
      >
        {resolvedChildren}
      </ReactRouterNavLink>
    )
  },
)
