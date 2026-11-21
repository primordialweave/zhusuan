import { JadeIcon, type JadeIconName } from '@/design-system'
import type { PrimaryNavigationKey } from './primaryNavigation'

const DOCK_ICON_MAP: Record<PrimaryNavigationKey, JadeIconName> = {
  dashboard: 'dock-dashboard',
  projects: 'dock-projects',
  calendar: 'dock-calendar',
  analytics: 'dock-analytics',
  settings: 'dock-settings',
}

export default function DockIcon({
  active = false,
  name,
}: {
  active?: boolean
  name: PrimaryNavigationKey
}) {
  return (
    <JadeIcon
      detail="carved"
      motionPreset="interactive"
      name={DOCK_ICON_MAP[name]}
      size="1em"
      tone={active ? 'on-accent' : 'jade'}
    />
  )
}
