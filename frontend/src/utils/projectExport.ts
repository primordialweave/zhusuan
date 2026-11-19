import type { Payment, Project } from '@/api/project'
import type { CsvValue } from './csv'

const projectStatusLabels: Record<string, string> = {
  active: '进行中',
  archived: '已归档',
  completed: '已完成',
  notstarted: '未开始',
  overdue: '已逾期',
  pending: '即将交付',
}

const paymentStatusLabels: Record<string, string> = {
  confirmed: '已收款',
  overdue: '已逾期',
  paid: '已收款',
  pending: '待收款',
}

/** Dictionary labels by stored value; anything missing is exported as stored. */
export interface ProjectExportLabels {
  method?: Record<string, string>
  stage?: Record<string, string>
  type?: Record<string, string>
}

const day = (value?: string | null) => (value ? value.slice(0, 10) : '')

export const projectExportFilename = (project: Project) =>
  `珠算-项目-${project.name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || project.id}.csv`

/** One project as a sheet: its record first, then every payment in plan order. */
export function buildProjectExportRows(
  project: Project,
  payments: Payment[],
  labels: ProjectExportLabels = {},
): CsvValue[][] {
  const received = project.received_amount || 0
  const progress =
    project.total_amount > 0 ? `${Math.round((received / project.total_amount) * 100)}%` : '—'
  const ordered = [...payments].sort((a, b) => day(a.plan_date).localeCompare(day(b.plan_date)))

  return [
    ['项目名称', project.name],
    ['客户', project.company],
    ['合同编号', project.contract_number],
    ['项目类型', labels.type?.[project.type] ?? project.type],
    ['状态', projectStatusLabels[project.status] ?? project.status],
    ['签约日期', day(project.contract_date)],
    ['开始日期', day(project.start_date)],
    ['截止日期', day(project.end_date)],
    ['合同金额', project.total_amount],
    ['已收款', received],
    ['待收款', project.total_amount - received],
    ['收款进度', progress],
    ['备注', project.description],
    [],
    ['收款阶段', '金额', '占比', '计划日期', '实际到账日期', '状态', '收款方式', '备注'],
    ...ordered.map((payment) => [
      labels.stage?.[payment.stage] ?? payment.stage,
      payment.amount,
      payment.percentage ? `${payment.percentage}%` : '',
      day(payment.plan_date),
      day(payment.actual_date),
      paymentStatusLabels[payment.status] ?? payment.status,
      labels.method?.[payment.method] ?? payment.method,
      payment.remark,
    ]),
  ]
}
