import { paymentApi, type PaymentRequest } from '@/api/project'
import { toDateOnly } from '@/utils/dateOnly'
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
  ...(item.planDate ? { plan_date: toDateOnly(item.planDate) } : {}),
  ...(item.actualDate ? { actual_date: toDateOnly(item.actualDate) } : {}),
  project_id: projectId,
  remark: item.remark,
  stage: item.stage || 'receipt',
  status: item.status,
})

const itemId = (item: PaymentPlanItem, state: PaymentPlanSaveState) =>
  state.savedItems.get(item.clientKey)?.id ?? item.id

/** Loaded records are already saved; unchanged legacy dates and statuses must not be rewritten. */
export function createLoadedPaymentPlanSaveState(projectId: number, items: PaymentPlanItem[]) {
  const state = createPaymentPlanSaveState()
  for (const item of items) {
    if (!item.id) continue
    state.knownIds.add(item.id)
    state.savedItems.set(item.clientKey, {
      id: item.id,
      signature: JSON.stringify(payloadFor(projectId, item)),
    })
  }
  return state
}

export function getUnsavedPaymentItems(
  projectId: number,
  items: PaymentPlanItem[],
  state: PaymentPlanSaveState,
) {
  return items.filter(
    (item) =>
      state.savedItems.get(item.clientKey)?.signature !==
      JSON.stringify(payloadFor(projectId, item)),
  )
}

const failureMessage = (reason: unknown, fallback: string) => {
  const message = reason instanceof Error ? reason.message : reason
  return typeof message === 'string' && message.trim() ? message : fallback
}

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
  const deletionFailures = deletions.flatMap((result) =>
    result.status === 'rejected' ? [failureMessage(result.reason, '删除失败')] : [],
  )
  deletions.forEach((result, index) => {
    if (result.status !== 'fulfilled') return
    const deletedId = removedIds[index]!
    state.knownIds.delete(deletedId)
    for (const [key, saved] of state.savedItems) {
      if (saved.id === deletedId) state.savedItems.delete(key)
    }
  })

  // Finish the requested deletions before submitting the remaining payment plan.
  if (deletionFailures.length) {
    return {
      ids: new Map<string, number>(),
      summary: `收款删除失败：${deletionFailures[0]}${deletionFailures.length > 1 ? `；另有 ${deletionFailures.length - 1} 笔未删除` : ''}`,
      issue: `${deletionFailures.length} 笔收款删除失败：${deletionFailures.join('；')}。已完成的操作已保留，请再次保存继续。`,
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
        message: failureMessage(result.reason, '保存失败'),
      })
      return
    }
    const id = write.id ?? result.value.data.data.id
    state.knownIds.add(id)
    state.savedItems.set(write.item.clientKey, { id, signature: write.signature })
    ids.set(write.item.clientKey, id)
  })
  const firstFailure = failures[0]
  return {
    ids,
    summary: firstFailure
      ? `第 ${firstFailure.index} 笔收款未保存：${firstFailure.message}${failures.length > 1 ? `；另有 ${failures.length - 1} 笔未保存` : ''}`
      : '',
    issue: failures.length
      ? `${failures.map(({ index, message }) => `第 ${index} 笔收款未保存：${message}`).join('；')}。已保存的款项会保留，请再次保存继续。`
      : null,
  }
}
