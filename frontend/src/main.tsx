import './styles/motion.css'
import './assets/main.css'
import './styles/layout.css'
import './styles/dashboard.css'
import './styles/login.css'
import './styles/design-showcase.css'
// ODS owns tokens, foundations, components, and patterns; Tailwind is loaded once by main.css.
import './design-system/styles.css'
import 'remixicon/fonts/remixicon.css'

import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

import { migrateBrandPreferences } from '@/utils/brandMigration'

void migrateBrandPreferences().then(() => import('./bootstrap'))
