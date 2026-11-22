import type { Payment } from '@/api/project'
import { toDateOnly } from './dateOnly'

interface ReceiptOrderValues {
  id?: number
  status: string
  actualDate?: string | null
  planDate?: string | null
}

const orderGroup = (item: ReceiptOrderValues) =>
  item.status === 'confirmed' || item.status === 'paid' ? (item.actualDate ? 0 : 1) : 2

/** Actual receipts first, unknown receipt dates next, then unconfirmed historical plans. */
function compareReceiptOrder(left: ReceiptOrderValues, right: ReceiptOrderValues) {
  const group = orderGroup(left)
  const groupDifference = group - orderGroup(right)
  if (groupDifference) return groupDifference
  const dateDifference =
    group === 0
      ? toDateOnly(left.actualDate).localeCompare(toDateOnly(right.actualDate))
      : group === 2
        ? toDateOnly(left.planDate).localeCompare(toDateOnly(right.planDate))
        : 0
  return (
    dateDifference || (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER)
  )
}

export function sortReceiptItems<T extends ReceiptOrderValues>(items: readonly T[]): T[] {
  return [...items].sort(compareReceiptOrder)
}

export function sortPaymentsByReceiptDate(payments: readonly Payment[]): Payment[] {
  return [...payments].sort((left, right) =>
    compareReceiptOrder(
      { id: left.id, status: left.status, actualDate: left.actual_date, planDate: left.plan_date },
      {
        id: right.id,
        status: right.status,
        actualDate: right.actual_date,
        planDate: right.plan_date,
      },
    ),
  )
}
