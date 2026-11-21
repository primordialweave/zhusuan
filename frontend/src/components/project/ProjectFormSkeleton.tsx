import { FormGrid, Skeleton } from '@/design-system'

function Fields({ count }: { count: number }) {
  return (
    <FormGrid columns={2}>
      {Array.from({ length: count }, (_, index) => (
        <div className="project-field-skeleton" key={index}>
          <Skeleton height="1rem" shape="text" width={index % 2 ? '5rem' : '6rem'} />
          <Skeleton height="var(--ods-control-height-md)" />
        </div>
      ))}
    </FormGrid>
  )
}

/** Mirrors the form's columns while its project data is still unavailable. */
export function ProjectFormSkeleton({ payment = false }: { payment?: boolean }) {
  return (
    <div
      aria-busy="true"
      aria-label={payment ? '正在加载收款表单' : '正在加载项目表单'}
      className={payment ? 'project-form-skeleton' : 'project-compose-layout project-form-skeleton'}
      role="status"
    >
      <div className="project-form">
        {(payment ? [6] : [6, 4, 6]).map((count, index) => (
          <div className="project-form-section project-skeleton-section" key={index}>
            <Skeleton height="1.5rem" shape="text" width="8rem" />
            <Fields count={count} />
          </div>
        ))}
      </div>
      {!payment ? (
        <div aria-hidden="true" className="project-form-aside">
          <Skeleton height="1.5rem" shape="text" width="75%" />
          <Skeleton height="1rem" shape="text" width="50%" />
          <Skeleton height="0.5rem" />
          {Array.from({ length: 4 }, (_, index) => (
            <div className="project-field-skeleton" key={index}>
              <Skeleton height="1rem" shape="text" width="45%" />
              <Skeleton height="1.5rem" shape="text" width="65%" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
