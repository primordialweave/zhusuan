import { matchPath } from 'react-router-dom'

export type PrimaryNavigationKey = 'dashboard' | 'projects' | 'calendar' | 'analytics' | 'settings'

export interface PrimaryNavigationItem {
  key: PrimaryNavigationKey
  label: string
  /** Route patterns that keep this entry selected, including task routes outside its prefix. */
  matches: readonly string[]
  path: string
}

export const primaryNavigationItems: readonly PrimaryNavigationItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    matches: ['/dashboard'],
    path: '/dashboard',
  },
  {
    key: 'projects',
    label: '项目管理',
    matches: ['/projects/*', '/payment/create'],
    path: '/projects',
  },
  {
    key: 'calendar',
    label: '收款日历',
    matches: ['/calendar'],
    path: '/calendar',
  },
  {
    key: 'analytics',
    label: '数据分析',
    matches: ['/analytics'],
    path: '/analytics',
  },
  {
    key: 'settings',
    label: '系统设置',
    matches: ['/settings', '/design-system'],
    path: '/settings',
  },
]

export const getActiveNavigationKey = (pathname: string): PrimaryNavigationKey | null =>
  primaryNavigationItems.find((item) =>
    item.matches.some((pattern) => matchPath(pattern, pathname) !== null),
  )?.key ?? null
