/**
 * @file api/dashboard.ts
 * @description 仪表盘相关 API
 * 提供首页统计数据、收入趋势图表及近期项目/款项数据的查询接口。
 */
import api, { type ApiResponse } from './index'
import type { Project, Payment } from './project'

// 仪表盘核心统计数据
export interface DashboardStats {
  total_amount: number // 总合同金额
  paid_amount: number // 已回款金额
  pending_amount: number // 待回款金额
  overdue_amount: number // 逾期金额
  total_trend: number // 总金额环比增长率
  paid_trend: number // 回款环比增长率
  pending_trend: number // 待回款环比增长率
  overdue_trend: number // 逾期环比增长率
  avg_collection_days: number // 平均回款周期
  avg_collection_days_trend: number // 回款周期环比变化
}

// 收入趋势图表数据
export interface IncomeTrend {
  start_date?: string // 实际查询的日期范围
  end_date?: string
  labels: string[] // X轴标签 (日期)
  actual_values: number[] // 实际收入
  expected_values: number[] // 预计收入
}

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year'

/** 统计范围：固定的滚动周期，或自选的自然年 / 自然月（month 为 0 表示整年）。 */
export type DashboardScope = DashboardPeriod | { month: number; year: number }

const scopeParams = (scope?: DashboardScope) =>
  typeof scope === 'object'
    ? { month: scope.month || undefined, year: scope.year }
    : { period: scope }

// 仪表盘 API 集合
export const dashboardApi = {
  // 获取统计数据
  getStats: (scope?: DashboardScope, signal?: AbortSignal) =>
    api.get<ApiResponse<DashboardStats>>('/dashboard/stats', {
      params: { ...scopeParams(scope), _t: Date.now() },
      signal,
    }),

  // 获取收入趋势
  getIncomeTrend: (scope?: DashboardScope, signal?: AbortSignal) =>
    api.get<ApiResponse<IncomeTrend>>('/dashboard/income-trend', {
      params: { ...scopeParams(scope), _t: Date.now() },
      signal,
    }),

  // 获取近期项目
  getRecentProjects: (signal?: AbortSignal) =>
    api.get<ApiResponse<Project[]>>('/dashboard/recent-projects', {
      params: { _t: Date.now() },
      signal,
    }),

  // 获取即将到期收款
  getUpcomingPayments: (signal?: AbortSignal) =>
    api.get<ApiResponse<Payment[]>>('/dashboard/upcoming-payments', {
      params: { _t: Date.now() },
      signal,
    }),
}
