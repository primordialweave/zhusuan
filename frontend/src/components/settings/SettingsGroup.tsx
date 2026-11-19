import { useId, type ReactNode } from 'react'
import { Card } from '@/design-system'

export interface SettingsGroupProps {
  /** Controls beside the title, such as a search field or the group's main action. */
  actions?: ReactNode
  children: ReactNode
  /** A row along the bottom edge of the card; the group's save button lives here. */
  footer?: ReactNode
  /** Rows and tables run edge to edge; forms keep the card's padding. */
  flush?: boolean
  title?: ReactNode
}

/** One titled card of related settings. Every settings page is a short stack of these. */
export default function SettingsGroup({
  actions,
  children,
  flush = false,
  footer,
  title,
}: SettingsGroupProps) {
  const titleId = useId()

  return (
    <section aria-labelledby={title ? titleId : undefined} className="settings-group">
      {title || actions ? (
        <header className="settings-group__header">
          {title ? (
            <h2 className="settings-group__title" id={titleId}>
              {title}
            </h2>
          ) : null}
          {actions ? <div className="settings-group__actions">{actions}</div> : null}
        </header>
      ) : null}
      <Card.Root className="settings-group__card" gap="none" padding="none">
        <div className="settings-group__body" data-flush={flush || undefined}>
          {children}
        </div>
        {footer ? <div className="settings-group__footer">{footer}</div> : null}
      </Card.Root>
    </section>
  )
}
