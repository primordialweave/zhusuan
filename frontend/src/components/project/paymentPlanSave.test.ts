import { beforeEach, describe, expect, it, vi } from 'vitest'
import { paymentApi } from '@/api/project'
import { createPaymentPlanItem } from './paymentPlan'
import {
  createPaymentPlanSaveState,
  hasUnsavedPaymentPlan,
  savePaymentPlan,
} from './paymentPlanSave'

vi.mock('@/api/project', () => ({
  paymentApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

describe('payment plan date payloads', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(paymentApi.create).mockResolvedValue({ data: { data: { id: 7 } } } as never)
    vi.mocked(paymentApi.update).mockResolvedValue({ data: { data: { id: 7 } } } as never)
  })

  it.each(['2026-11-22T00:00:00+14:00', '2026-11-22T23:00:00-12:00', '2026-11-22T00:00:00Z'])(
    'writes an actual receipt date from %s without inventing a payment plan',
    async (actualDate) => {
      const item = { ...createPaymentPlanItem(), amount: '100', actualDate, stage: '' }
      await savePaymentPlan(42, [item], createPaymentPlanSaveState())
      expect(paymentApi.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        actual_date: '2026-11-22', status: 'confirmed', stage: 'receipt',
      }))
      expect(vi.mocked(paymentApi.create).mock.calls[0]?.[0]).not.toHaveProperty('plan_date')
      expect(item.actualDate).toBe(actualDate)
    },
  )

  it.each(['2026-11-22T00:00:00+14:00', '2026-11-22T23:00:00-12:00', '2026-11-22T00:00:00Z'])(
    'sends the calendar date from %s for creates and updates without changing the item',
    async (planDate) => {
      const item = { ...createPaymentPlanItem(), amount: '100', planDate }
      const state = createPaymentPlanSaveState()
      const result = await savePaymentPlan(42, [item], state)
      expect(result.issue).toBeNull()
      expect(result.summary).toBe('')
      expect(paymentApi.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ project_id: 42, plan_date: '2026-11-22' }),
      )
      expect(item.planDate).toBe(planDate)
      expect(hasUnsavedPaymentPlan(42, [item], state)).toBe(false)
      const changed = { ...item, amount: '200' }
      await savePaymentPlan(42, [changed], state)
      expect(paymentApi.update).toHaveBeenCalledExactlyOnceWith(
        7,
        expect.objectContaining({ project_id: 42, plan_date: '2026-11-22', amount: 200 }),
      )
      expect(paymentApi.create).toHaveBeenCalledOnce()
      expect(hasUnsavedPaymentPlan(42, [changed], state)).toBe(false)
    },
  )
})

describe('payment plan failure summaries', () => {
  beforeEach(() => vi.resetAllMocks())

  it('keeps the first failed installment and reason in a compact summary while retaining all details', async () => {
    vi.mocked(paymentApi.create)
      .mockResolvedValueOnce({ data: { data: { id: 7 } } } as never)
      .mockRejectedValueOnce(new Error('计划日期格式错误'))
      .mockRejectedValueOnce(new Error('网络暂时不可用'))
    const items = Array.from({ length: 3 }, () => ({
      ...createPaymentPlanItem(true),
      amount: '100',
      planDate: '2026-11-22',
    }))
    const state = createPaymentPlanSaveState()
    const result = await savePaymentPlan(42, items, state)
    expect(result.summary).toBe('第 2 笔收款未保存：计划日期格式错误；另有 1 笔未保存')
    expect(result.issue).toContain('第 3 笔收款未保存：网络暂时不可用')
    expect(state.knownIds).toEqual(new Set([7]))
  })

  it('keeps deletion reasons and reports how many further deletions failed', async () => {
    vi.mocked(paymentApi.delete)
      .mockRejectedValueOnce(new Error('收款已被删除'))
      .mockRejectedValueOnce(new Error('网络暂时不可用'))
    const state = createPaymentPlanSaveState([7, 8])
    const result = await savePaymentPlan(42, [], state)
    expect(result.summary).toBe('收款删除失败：收款已被删除；另有 1 笔未删除')
    expect(result.issue).toContain('2 笔收款删除失败：收款已被删除；网络暂时不可用')
    expect(state.knownIds).toEqual(new Set([7, 8]))
    expect(paymentApi.create).not.toHaveBeenCalled()
  })
})
