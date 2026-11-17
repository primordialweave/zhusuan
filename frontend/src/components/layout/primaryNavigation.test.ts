import { describe, expect, it } from 'vitest'
import { getActiveNavigationKey, primaryNavigationItems } from './primaryNavigation'

describe('primary navigation', () => {
  it('offers the five top-level entries in Dock order', () => {
    expect(primaryNavigationItems.map(({ key, label, path }) => ({ key, label, path }))).toEqual([
      { key: 'dashboard', label: '工作台', path: '/dashboard' },
      { key: 'projects', label: '项目管理', path: '/projects' },
      { key: 'calendar', label: '收款日历', path: '/calendar' },
      { key: 'analytics', label: '数据分析', path: '/analytics' },
      { key: 'settings', label: '系统设置', path: '/settings' },
    ])
  })

  it.each([
    ['/dashboard', 'dashboard'],
    ['/projects', 'projects'],
    ['/projects/create', 'projects'],
    ['/projects/edit/7', 'projects'],
    ['/projects/42', 'projects'],
    ['/projects/42/payment/create', 'projects'],
    ['/payment/create', 'projects'],
    ['/calendar', 'calendar'],
    ['/analytics', 'analytics'],
    ['/settings', 'settings'],
    ['/design-system', 'settings'],
  ])('keeps %s under the %s entry', (pathname, key) => {
    expect(getActiveNavigationKey(pathname)).toBe(key)
  })

  it.each(['/login', '/', '/payments', '/dashboard/extra', '/unknown'])(
    'selects nothing for %s',
    (pathname) => {
      expect(getActiveNavigationKey(pathname)).toBeNull()
    },
  )
})
