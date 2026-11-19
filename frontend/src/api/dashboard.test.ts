import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './index'
import { dashboardApi } from './dashboard'

vi.mock('./index', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('dashboardApi cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes AbortSignal through every dashboard request config', () => {
    const signal = new AbortController().signal

    dashboardApi.getStats('month', signal)
    dashboardApi.getIncomeTrend('week', signal)
    dashboardApi.getRecentProjects(signal)
    dashboardApi.getUpcomingPayments(signal)

    expect(vi.mocked(api.get).mock.calls).toEqual([
      ['/dashboard/stats', expect.objectContaining({ signal })],
      ['/dashboard/income-trend', expect.objectContaining({ signal })],
      ['/dashboard/recent-projects', expect.objectContaining({ signal })],
      ['/dashboard/upcoming-payments', expect.objectContaining({ signal })],
    ])
  })

  it('sends a chosen calendar year or month instead of a rolling period', () => {
    dashboardApi.getStats({ month: 0, year: 2025 })
    dashboardApi.getIncomeTrend({ month: 3, year: 2025 })
    dashboardApi.getStats('week')

    const params = vi
      .mocked(api.get)
      .mock.calls.map(([, config]) => config?.params as Record<string, unknown>)
    expect(params[0]).toMatchObject({ year: 2025 })
    expect(params[0].month).toBeUndefined()
    expect(params[0].period).toBeUndefined()
    expect(params[1]).toMatchObject({ month: 3, year: 2025 })
    expect(params[2]).toMatchObject({ period: 'week' })
  })
})
