import { useEffect, useState } from 'react'
import './index.css'
import { AppNavigation } from './components/AppNavigation'
import { useHashRoute } from './routing'
import { DashboardPage } from './pages/DashboardPage'
import { CareJourneyPage } from './pages/CareJourneyPage'
import { CopilotPage } from './pages/CopilotPage'
import { EpisodePage } from './pages/EpisodePage'
import { NotFoundPage } from './pages/NotFoundPage'

const APPEARANCE_STORAGE_KEY = 'careloop-appearance'
const LARGE_TEXT_STORAGE_KEY = 'careloop-large-text'
const HIGH_CONTRAST_STORAGE_KEY = 'careloop-high-contrast'
const SIMPLE_MODE_STORAGE_KEY = 'careloop-simple-mode'

function readStoredBoolean(key) {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(key) === 'true' } catch { return false }
}

function readStoredAppearance() {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    return ['light', 'dark', 'system'].includes(stored) ? stored : 'system'
  } catch { return 'system' }
}

function App() {
  const { route } = useHashRoute()
  const [appearance, setAppearance] = useState(readStoredAppearance)
  const [largeText, setLargeText] = useState(() => readStoredBoolean(LARGE_TEXT_STORAGE_KEY))
  const [highContrast, setHighContrast] = useState(() => readStoredBoolean(HIGH_CONTRAST_STORAGE_KEY))
  const [simpleMode, setSimpleMode] = useState(() => readStoredBoolean(SIMPLE_MODE_STORAGE_KEY))

  useEffect(() => {
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance)
      window.localStorage.setItem(LARGE_TEXT_STORAGE_KEY, String(largeText))
      window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(highContrast))
      window.localStorage.setItem(SIMPLE_MODE_STORAGE_KEY, String(simpleMode))
    } catch {
      // Preferences remain session-only when browser storage is unavailable.
    }
  }, [appearance, largeText, highContrast, simpleMode])

  useEffect(() => {
    document.documentElement.dataset.theme = appearance
    return () => { delete document.documentElement.dataset.theme }
  }, [appearance])

  useEffect(() => {
    document.body.classList.toggle('a11y-large-text', largeText)
    document.body.classList.toggle('a11y-high-contrast', highContrast)
    document.body.classList.toggle('a11y-simple-mode', simpleMode)
    return () => document.body.classList.remove('a11y-large-text', 'a11y-high-contrast', 'a11y-simple-mode')
  }, [largeText, highContrast, simpleMode])

  let page
  if (route.name === 'dashboard') page = <DashboardPage />
  else if (route.name === 'care-journey') page = <CareJourneyPage />
  else if (route.name === 'episode') page = <EpisodePage key={route.episodeId} episodeId={route.episodeId} />
  else if (route.name === 'copilot') page = <CopilotPage />
  else page = <NotFoundPage />

  return (
    <>
      <AppNavigation
        route={route}
        appearance={appearance}
        setAppearance={setAppearance}
        largeText={largeText}
        setLargeText={setLargeText}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        simpleMode={simpleMode}
        setSimpleMode={setSimpleMode}
      />
      <main id="main-content" className="app-main">{page}</main>
    </>
  )
}

export default App
