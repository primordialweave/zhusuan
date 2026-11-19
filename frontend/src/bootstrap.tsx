import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { setAuthLogout } from '@/api'
import { router } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { applyAppearanceBeforeRender } from '@/stores/appearance'
import { applyThemeBeforeRender } from '@/stores/theme'

applyThemeBeforeRender()
applyAppearanceBeforeRender()

setAuthLogout(async () => {
  await useAuthStore.getState().logout()
  await router.navigate('/login')
})

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
