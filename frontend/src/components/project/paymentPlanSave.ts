import { paymentApi, type PaymentRequest } from '@/api/project'
import type { PaymentPlanItem } from './paymentPlan'

export interface PaymentPlanSaveState {
  knownIds: Set<number>
  savedItems: Map<string, { id: number; signature: string }>
}

export const createPaymentPlanSaveState = (ids: number[] = []): PaymentPlanSaveState => ({
  knownIds: new Set(ids),
  savedItems: new Map(),
})

const payloadFor = (projectId: number, item: PaymentPlanItem): PaymentRequest => ({
  amount: Number(item.amount) || 0,
  method: item.method || 'bank_transfer',
  plan_date: item.planDate,
  project_id: projectId,
  remark: item.remark,
  stage: item.stage || '款项',
  status: item.status,
})

const itemId = (item: PaymentPlanItem, state: PaymentPlanSaveState) =>
  state.savedItems.get(item.clientKey)?.id ?? item.id

export function hasUnsavedPaymentPlan(
  projectId: number,
  items: PaymentPlanItem[],
  state: PaymentPlanSaveState,
) {
  const desiredIds = new Set(items.map((item) => itemId(item, state)).filter(Boolean))
  return (
    [...state.knownIds].some((id) => !desiredIds.has(id)) ||
    items.some(
      (item) =>
        state.savedItems.get(item.clientKey)?.signature !==
        JSON.stringify(payloadFor(projectId, item)),
    )
  )
}

/** Retains acknowledged mutations so retrying a partial save never repeats successful writes. */
export async function savePaymentPlan(
  projectId: number,
  items: PaymentPlanItem[],
  state: PaymentPlanSaveState,
) {
  const desiredIds = new Set(items.map((item) => itemId(item, state)).filter(Boolean))
  const removedIds = [...state.knownIds].filter((id) => !desiredIds.has(id))
  const deletions = await Promise.allSettled(removedIds.map((id) => paymentApi.delete(id)))
  const failedDeletionCount = deletions.filter((result) => result.status === 'rejected').length
  deletions.forEach((result, index) => {
    if (result.status !== 'fulfilled') return
    const deletedId = removedIds[index]!
    state.knownIds.delete(deletedId)
    for (const [key, saved] of state.savedItems) {
      if (saved.id === deletedId) state.savedItems.delete(key)
    }
  })

  // Finish the requested deletions before submitting the remaining payment plan.
  if (failedDeletionCount) {
    return {
      ids: new Map<string, number>(),
      issue: `${failedDeletionCount} 笔收款删除失败。已完成的操作已保留，请再次保存继续。`,
    }
  }

  const writes = items.flatMap((item, index) => {
    const payload = payloadFor(projectId, item)
    const signature = JSON.stringify(payload)
    if (state.savedItems.get(item.clientKey)?.signature === signature) return []
    const id = itemId(item, state)
    return [{ item, index, payload, signature, id }]
  })
  const results = await Promise.allSettled(
    writes.map(({ id, payload }) =>
      id ? paymentApi.update(id, payload) : paymentApi.create(payload),
    ),
  )
  const ids = new Map<string, number>()
  const failures: { index: number; message: string }[] = []
  results.forEach((result, index) => {
    const write = writes[index]!
    if (result.status !== 'fulfilled') {
      failures.push({
        index: write.index + 1,
        message: result.reason instanceof Error ? result.reason.message : '保存失败',
      })
      return
    }
    const id = write.id ?? result.value.data.data.id
    state.knownIds.add(id)
    state.savedItems.set(write.item.clientKey, { id, signature: write.signature })
    ids.set(write.item.clientKey, id)
  })
  return {
    ids,
    issue: failures.length
      ? `${failures.map(({ index, message }) => `第 ${index} 期收款未保存：${message}`).join('；')}。已保存的款项会保留，请再次保存继续。`
      : null,
  }
}
