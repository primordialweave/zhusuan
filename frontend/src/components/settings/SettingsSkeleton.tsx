import { FormGrid, Skeleton, Table } from '@/design-system'

interface SettingsSkeletonProps {
  label: string
  rows?: number
}

export function SettingsTableSkeleton({
  columns = 5,
  label,
  rows = 4,
}: SettingsSkeletonProps & { columns?: number }) {
  return (
    <div aria-busy="true" aria-label={label} className="settings-loading" role="status">
      <Table.Root aria-hidden="true" className="settings-table">
        <Table.Header>
          <Table.Row>
            {Array.from({ length: columns }, (_, column) => (
              <Table.Column key={column}>
                <Skeleton height="0.875rem" width={column === 0 ? '55%' : '65%'} />
              </Table.Column>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: rows }, (_, row) => (
            <Table.Row key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <Table.Cell key={column}>
                  <Skeleton height="1.125rem" width={column === 0 ? '80%' : '60%'} />
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  )
}

export function SettingsListSkeleton({ label, rows = 4 }: SettingsSkeletonProps) {
  return (
    <div aria-busy="true" aria-label={label} className="settings-loading" role="status">
      {Array.from({ length: rows }, (_, row) => (
        <div className="settings-loading__row" key={row}>
          <Skeleton height="1.125rem" width={row % 2 === 0 ? '65%' : '48%'} />
          <Skeleton height="0.875rem" width="35%" />
        </div>
      ))}
    </div>
  )
}

export function SettingsFormSkeleton({
  columns = 2,
  fields = 6,
  label,
  wideFields = [],
}: {
  columns?: 2 | 3
  fields?: number
  label: string
  wideFields?: readonly number[]
}) {
  return (
    <div aria-busy="true" aria-label={label} className="settings-loading" role="status">
      <FormGrid columns={columns}>
        {Array.from({ length: fields }, (_, field) => (
          <div
            className={[
              'settings-loading__field',
              wideFields.includes(field) ? 'settings-field--wide' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={field}
          >
            <div className="settings-loading__label">
              <Skeleton height="0.875rem" width="40%" />
            </div>
            <Skeleton height="var(--ods-control-height-md)" />
          </div>
        ))}
      </FormGrid>
    </div>
  )
}
