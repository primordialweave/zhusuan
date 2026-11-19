import { Chip, type ChipSize, type ChipTone } from '@/design-system'

const projectStatusMeta: Record<string, { label: string; tone: ChipTone }> = {
  active: { label: '进行中', tone: 'accent' },
  archived: { label: '已归档', tone: 'neutral' },
  completed: { label: '已完成', tone: 'success' },
  notstarted: { label: '未开始', tone: 'neutral' },
  overdue: { label: '已逾期', tone: 'danger' },
  pending: { label: '即将交付', tone: 'warning' },
}

const paymentStatusMeta: Record<string, { label: string; tone: ChipTone }> = {
  confirmed: { label: '已收款', tone: 'success' },
  overdue: { label: '已逾期', tone: 'warning' },
  paid: { label: '已收款', tone: 'success' },
  pending: { label: '待收款', tone: 'neutral' },
}

export function ProjectStatusChip({ size, status }: { size?: ChipSize; status: string }) {
  const meta = projectStatusMeta[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <Chip size={size} tone={meta.tone}>
      {meta.label}
    </Chip>
  )
}

export function PaymentStatusChip({ status }: { status: string }) {
  const meta = paymentStatusMeta[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <Chip size="sm" tone={meta.tone}>
      {meta.label}
    </Chip>
  )
}
