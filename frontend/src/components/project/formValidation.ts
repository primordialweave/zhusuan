import type { ProjectRequest } from '@/api/project'
import type { PaymentPlanItem } from './paymentPlan'
import { isPositiveMoney } from './money'

export type ProjectFieldErrors = Partial<Record<keyof ProjectRequest, string>>
export type PaymentFieldErrors = Partial<
  Record<'amount' | 'planDate' | 'stage' | 'method' | 'status', string>
>
export type PaymentPlanErrors = Record<string, PaymentFieldErrors>

export function validateProject(form: ProjectRequest, amount: string): ProjectFieldErrors {
  const errors: ProjectFieldErrors = {}
  if (!form.name.trim()) errors.name = '请输入项目名称'
  if (!form.company.trim()) errors.company = '请输入客户名称'
  if (!form.type) errors.type = '请选择项目类型'
  if (!form.status) errors.status = '请选择项目状态'
  if (!form.start_date) errors.start_date = '请选择开始日期'
  if (!form.end_date) errors.end_date = '请选择截止日期'
  else if (form.start_date && form.end_date < form.start_date)
    errors.end_date = '截止日期不能早于开始日期'
  if (!form.contract_date) errors.contract_date = '请选择合同日期'
  if (!form.payment_method) errors.payment_method = '请选择付款模式'
  if (!isPositiveMoney(amount)) errors.total_amount = '请输入大于 0 的合同金额，最多保留两位小数'
  return errors
}

export function validatePaymentPlan(items: PaymentPlanItem[]): PaymentPlanErrors {
  const errors: PaymentPlanErrors = {}
  for (const item of items) {
    const fields: PaymentFieldErrors = {}
    if (!isPositiveMoney(item.amount)) fields.amount = '请输入大于 0 的收款金额，最多保留两位小数'
    if (!item.planDate) fields.planDate = '请选择收款日期'
    if (!item.stage) fields.stage = '请选择款项阶段'
    if (!item.method) fields.method = '请选择收款方式'
    if (!item.status) fields.status = '请选择收款状态'
    if (Object.keys(fields).length) errors[item.clientKey] = fields
  }
  return errors
}
