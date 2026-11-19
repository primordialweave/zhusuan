import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { Surface } from '../../components/surface'

export interface WorkSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** The element that scrolls; route scroll restoration attaches here. */
  scrollRef?: Ref<HTMLDivElement>
}

/** The single business panel that floats over the scene and scrolls its own content. */
export const WorkSurface = forwardRef<HTMLDivElement, WorkSurfaceProps>(function WorkSurface(
  { children, className, scrollRef, ...props },
  ref,
) {
  return (
    <Surface
      {...props}
      className={['ods-work-surface', className].filter(Boolean).join(' ')}
      padding="none"
      radius="surface"
      ref={ref}
      variant="raised"
    >
      <div className="ods-work-surface__scroll" data-slot="scroll" ref={scrollRef}>
        {children}
      </div>
    </Surface>
  )
})
