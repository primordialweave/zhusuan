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
  it('writes the record, then the payments in plan order with readable statuses', () => {
    const rows = buildProjectExportRows(project, payments)

    expect(rows).toContainEqual(['状态', '进行中'])
    expect(rows).toContainEqual(['待收款', 2400])
    expect(rows).toContainEqual(['收款进度', '60%'])
    expect(rows.slice(-2)).toEqual([
      ['首付款', 3600, '60%', '2024-10-20', '2024-10-21', '已收款', '转账', undefined],
      ['尾款', 2400, '', '2024-12-20', '', '待收款', undefined, undefined],
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
