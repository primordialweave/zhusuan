import dayjs from 'dayjs'

export interface PaymentPlanItem {
  clientKey: string
  id?: number
  amount: string
  method: string
  planDate: string
  actualDate: string
  remark: string
  stage: string
  status: string
}

let nextPaymentPlanKey = 0

export const isReceivedPayment = (status: string) => status === 'confirmed' || status === 'paid'

export const createPaymentPlanItem = (_installment = false): PaymentPlanItem => ({
  amount: '',
  clientKey: `payment-plan-${nextPaymentPlanKey++}`,
  method: 'bank_transfer',
  planDate: '',
  actualDate: dayjs().format('YYYY-MM-DD'),
  remark: '',
  stage: 'receipt',
  status: 'confirmed',
})
