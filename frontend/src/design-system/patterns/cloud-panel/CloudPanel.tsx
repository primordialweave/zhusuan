import { createElement, forwardRef, type HTMLAttributes, type ReactNode } from 'react'

export type CloudPanelPadding = 'md' | 'lg'

export interface CloudPanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'main' | 'section'
  /** Artwork painted on the pane, under the content and clipped to the cloud outline. */
  backdrop?: ReactNode
  children: ReactNode
  padding?: CloudPanelPadding
}

/**
 * A frosted pane with scalloped "cloud" corners that floats on a scene.
 *
 * It does not blur what is behind it. The page hands it a pre-blurred still through the
 * `--cloud-panel-backdrop` custom property (a complete background layer, usually `fixed` so
 * it lines up with the page's own backdrop); the pane paints that under a veil.
 */
export const CloudPanel = forwardRef<HTMLElement, CloudPanelProps>(function CloudPanel(
  { as = 'section', backdrop, children, className, padding = 'lg', ...props },
  ref,
) {
  return createElement(
    as,
    {
      ...props,
      className: ['ods-cloud-panel', className].filter(Boolean).join(' '),
      'data-padding': padding,
      'data-slot': 'cloud-panel',
      ref,
    },
    <div aria-hidden="true" className="ods-cloud-panel__pane" data-slot="pane">
      {backdrop}
    </div>,
    <div aria-hidden="true" className="ods-cloud-panel__rim" data-slot="rim" />,
    <div className="ods-cloud-panel__content" data-slot="content">
      {children}
    </div>,
  )
})
