import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { ConfirmProvider } from '@/components/common/ConfirmProvider'
import WindowTitleBar from '@/components/layout/WindowTitleBar'
import { JadeIconDefs, Toaster } from '@/design-system'
import { useAppearanceStore } from '@/stores/appearance'
import { useThemeStore } from '@/stores/theme'

export default function App() {
  const initializeAppearance = useAppearanceStore((state) => state.initializeAppearance)
  const initializeTheme = useThemeStore((state) => state.initializeTheme)

  useEffect(() => initializeTheme(), [initializeTheme])
  useEffect(() => initializeAppearance(), [initializeAppearance])

  return (
    <ConfirmProvider>
      <JadeIconDefs />
      <WindowTitleBar />
      <Outlet />
      <Toaster />
    </ConfirmProvider>
  )
}
