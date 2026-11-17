import { useLocation } from 'react-router-dom'
import { RouterNavLink, Surface } from '@/design-system'
import DockIcon from './DockIcon'
import { getActiveNavigationKey, primaryNavigationItems } from './primaryNavigation'

export default function AppDock() {
  const { pathname } = useLocation()
  const activeKey = getActiveNavigationKey(pathname)

  return (
    <Surface
      as="nav"
      aria-label="主导航"
      className="app-dock"
      density="dense"
      padding="none"
      radius="pill"
      variant="glass"
    >
      {primaryNavigationItems.map((item) => (
        <RouterNavLink
          active={item.key === activeKey}
          appearance="dock"
          className="app-dock__link"
          icon={<DockIcon name={item.key} />}
          key={item.key}
          to={item.path}
        >
          {item.label}
        </RouterNavLink>
      ))}
    </Surface>
  )
}
