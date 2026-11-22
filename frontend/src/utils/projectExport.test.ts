import { describe, expect, it } from 'vitest'
import type { Payment, Project } from '@/api/project'
import { buildProjectExportRows, projectExportFilename } from './projectExport'

const project = {
  company: '小旭姐',
  contract_date: '2024-10-16T00:00:00Z',
  contract_number: 'HT20241016',
  description: '',
  end_date: '2024-12-31T00:00:00Z',
  id: 7,
  name: '官网 改版/二期',
  received_amount: 3600,
  start_date: '2024-10-20T00:00:00Z',
  status: 'active',
  total_amount: 6000,
  type: '设计',
} as Project

const payments = [
  { amount: 2400, plan_date: '2024-12-20T00:00:00Z', stage: '尾款', status: 'pending' },
  {
    actual_date: '2024-10-21T00:00:00Z',
    amount: 3600,
    method: '转账',
    percentage: 60,
    plan_date: '2024-10-20T00:00:00Z',
    stage: '首付款',
    status: 'confirmed',
  },
] as Payment[]

describe('project export', () => {
  it('exports the default receipt classification in Chinese while giving dictionary labels priority', () => {
    const receipt = { ...payments[1], stage: 'receipt' }
    expect(buildProjectExportRows(project, [receipt]).at(-1)?.[0]).toBe('收款')
    expect(
      buildProjectExportRows(project, [receipt], { stage: { receipt: '维护费' } }).at(-1)?.[0],
    ).toBe('维护费')
  })

  it('keeps overpayment separate from the nonnegative contract balance and bounded collection rate', () => {
    const rows = buildProjectExportRows(
      { ...project, total_amount: 1000, received_amount: 1500 },
      [],
    )
    expect(rows).toContainEqual(['已收款', 1500])
    expect(rows).toContainEqual(['合同未收余额', 0])
    expect(rows).toContainEqual(['收款进度', '100%'])
    expect(rows).toContainEqual(['超收金额', 500])
    const negativeLegacy = buildProjectExportRows(
      { ...project, total_amount: 1000, received_amount: -100 },
      [],
    )
    expect(negativeLegacy).toContainEqual(['收款进度', '0%'])
    expect(negativeLegacy.some((row) => row[0] === '超收金额')).toBe(false)
  })
  it('exports actual receipts in chronological order and keeps legacy dates without assigning them to receipts', () => {
    const rows = buildProjectExportRows(project, [
      {
        ...payments[1],
        id: 8,
        stage: 'later',
        actual_date: '2026-11-21T00:00:00Z',
        plan_date: '2026-01-01',
      },
      {
        ...payments[1],
        id: 7,
        stage: 'earlier',
        actual_date: '2026-10-16T23:00:00-12:00',
        plan_date: '2026-12-31',
      },
      { ...payments[1], id: 9, stage: 'unknown', actual_date: null, plan_date: '2026-01-01' },
      { ...payments[0], id: 10, stage: 'pending', actual_date: null, plan_date: '2026-01-01' },
    ] as Payment[])
    const data = rows.slice(-4)
    expect(data.map((row) => row[0])).toEqual(['earlier', 'later', 'unknown', 'pending'])
    expect(data[0]?.[3]).toBe('2026-10-16')
    expect(data[0]?.[4]).toBe('2026-12-31')
    expect(data[2]?.[3]).toBe('')
  })
  it('writes the record, then actual receipts and legacy plans with readable statuses', () => {
    const rows = buildProjectExportRows(project, payments)

    expect(rows).toContainEqual(['状态', '进行中'])
    expect(rows).toContainEqual(['合同未收余额', 2400])
    expect(rows).toContainEqual(['收款进度', '60%'])
    expect(rows.slice(-2)).toEqual([
      ['首付款', 3600, '60%', '2024-10-21', '2024-10-20', '已收款', '转账', undefined],
      ['尾款', 2400, '', '', '2024-12-20', '待收款', undefined, undefined],
    ])
  })

  it('names the file after the project without characters a file system rejects', () => {
    expect(projectExportFilename(project)).toBe('珠算-项目-官网_改版_二期.csv')
  })

  it('writes dictionary labels where it has them and stored values where it does not', () => {
    const rows = buildProjectExportRows(project, payments, {
      method: { 转账: '银行转账' },
      stage: { 尾款: '尾款（结项）' },
      type: {},
    })

    expect(rows).toContainEqual(['项目类型', '设计'])
    expect(rows.at(-2)?.[6]).toBe('银行转账')
    expect(rows.at(-1)?.[0]).toBe('尾款（结项）')
  })
})
