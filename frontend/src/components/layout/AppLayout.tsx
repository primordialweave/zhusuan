import { useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppDock from '@/components/layout/AppDock'
import NotificationEntry from '@/components/layout/NotificationEntry'
import { handleWindowDragRegionDoubleClick } from '@/components/layout/windowDrag'
import JiangnanScene from '@/components/scene/JiangnanScene'
import { WorkSurface } from '@/design-system'
import { useRouteScroll } from '@/hooks/useRouteScroll'
import { getActiveNavigationKey } from './primaryNavigation'

export default function AppLayout() {
  const { pathname } = useLocation()
  const isWorkbench = getActiveNavigationKey(pathname) === 'dashboard'
  const scrollRef = useRef<HTMLDivElement>(null)
  useRouteScroll(scrollRef)

  return (
    <div className="app-container" data-view={isWorkbench ? 'workbench' : 'business'}>
      <JiangnanScene variant={isWorkbench ? 'workbench' : 'business'} />
      <div
        aria-hidden="true"
        className="app-titlebar-drag-region"
        onDoubleClick={handleWindowDragRegionDoubleClick}
      />
      <main className="app-main" id="mainContent">
        {isWorkbench ? (
          <Outlet />
        ) : (
          <WorkSurface className="app-work-surface" scrollRef={scrollRef} tabIndex={-1}>
            <div className="app-view-content ods-motion-fade-in" key={pathname}>
              <Outlet />
            </div>
          </WorkSurface>
        )}
      </main>
      <div className="app-dock-area">
        <AppDock />
        <NotificationEntry />
      </div>
    </div>
  )
}
