import { describe, expect, it } from 'vitest'
import type { Payment } from '@/api/project'
import { sortPaymentsByReceiptDate, sortReceiptItems } from './receiptOrder'

describe('receipt ordering', () => {
  it('orders actual dates and same-day IDs before unknown receipts and historical plans', () => {
    const items = [
      { id: 9, status: 'pending', actual_date: null, plan_date: '2026-12-02' },
      { id: 7, status: 'confirmed', actual_date: '2026-11-21T00:00:00Z', plan_date: '2026-01-01' },
      { id: 8, status: 'confirmed', actual_date: null, plan_date: '2026-01-01' },
      { id: 6, status: 'paid', actual_date: '2026-11-21T00:00:00+14:00', plan_date: '2026-12-31' },
      {
        id: 5,
        status: 'confirmed',
        actual_date: '2026-10-16T23:00:00-12:00',
        plan_date: '2026-12-31',
      },
      { id: 3, status: 'confirmed', actual_date: '', plan_date: '2026-12-31' },
      { id: 10, status: 'overdue', actual_date: null, plan_date: '2026-12-01' },
      { id: 4, status: 'pending', actual_date: null, plan_date: '2026-12-01' },
    ] as Payment[]
    expect(sortPaymentsByReceiptDate(items).map(({ id }) => id)).toEqual([5, 6, 7, 3, 8, 4, 10, 9])
    expect(items.map(({ id }) => id)).toEqual([9, 7, 8, 6, 5, 3, 10, 4])
    expect(
      sortReceiptItems(
        items.map((item) => ({
          ...item,
          actualDate: item.actual_date,
          planDate: item.plan_date,
        })),
      ).map(({ id }) => id),
    ).toEqual([5, 6, 7, 3, 8, 4, 10, 9])
  })

  it('keeps same-day unsaved drafts in their stable insertion order', () => {
    const items = [
      { status: 'confirmed', actualDate: '2026-11-21', clientKey: 'first' },
      { status: 'confirmed', actualDate: '2026-11-21', clientKey: 'second' },
    ]
    expect(sortReceiptItems(items).map(({ clientKey }) => clientKey)).toEqual(['first', 'second'])
  })

  it('places new same-day drafts after saved receipts so receiving an ID will not reverse their order', () => {
    const items = [
      { status: 'confirmed', actualDate: '2026-11-21', clientKey: 'new' },
      { id: 7, status: 'confirmed', actualDate: '2026-11-21', clientKey: 'saved' },
    ]
    expect(sortReceiptItems(items).map(({ clientKey }) => clientKey)).toEqual(['saved', 'new'])
  })
})
