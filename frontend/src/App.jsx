import { useEffect, useState } from 'react'
import './index.css'
import { EpisodePage } from './pages/EpisodePage'

const APPEARANCE_STORAGE_KEY = 'careloop-appearance'
const LARGE_TEXT_STORAGE_KEY = 'careloop-large-text'
const HIGH_CONTRAST_STORAGE_KEY = 'careloop-high-contrast'

function readStoredBoolean(key) {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function readStoredAppearance() {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    return ['light', 'dark', 'system'].includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

/**
 * CareLoop App Root
 * Handles accessibility toggles at the body level (large text, high contrast)
 */
function App() {
  const [appearance, setAppearance] = useState(readStoredAppearance)
  const [largeText, setLargeText] = useState(() => readStoredBoolean(LARGE_TEXT_STORAGE_KEY))
  const [highContrast, setHighContrast] = useState(() => readStoredBoolean(HIGH_CONTRAST_STORAGE_KEY))
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance)
      window.localStorage.setItem(LARGE_TEXT_STORAGE_KEY, String(largeText))
      window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(highContrast))
    } catch {
      // Preferences remain session-only when browser storage is unavailable.
    }
  }, [appearance, largeText, highContrast])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    document.documentElement.dataset.theme = appearance
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [appearance])

  // Apply a11y classes without replacing classes owned by the app shell.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    document.body.classList.toggle('a11y-large-text', largeText)
    document.body.classList.toggle('a11y-high-contrast', highContrast)

    return () => {
      document.body.classList.remove('a11y-large-text', 'a11y-high-contrast')
    }
  }, [largeText, highContrast])

  return (
    <>
      {/* Navigation */}
      <nav className="nav" aria-label="CareLoop navigation">
        <div className="nav__inner">
          <a href="/" className="nav__logo" aria-label="CareLoop home">
            CareLoop
          </a>
          <div className="nav__context">
            <span className="nav__context-label">Accessible care, kept together</span>
          </div>
          <div className="appearance-control">
            <button
              className="appearance-toggle"
              type="button"
              aria-expanded={preferencesOpen}
              aria-controls="appearance-panel"
              onClick={() => setPreferencesOpen(open => !open)}
            >
              <span aria-hidden="true">☼</span>
              <span>Accessibility &amp; appearance</span>
            </button>
            {preferencesOpen && (
              <div className="appearance-panel" id="appearance-panel" role="dialog" aria-label="Accessibility and appearance settings">
                <div className="appearance-panel__header">
                  <h2>Accessibility and appearance</h2>
                  <button
                    className="appearance-panel__close"
                    type="button"
                    onClick={() => setPreferencesOpen(false)}
                    aria-label="Close accessibility and appearance settings"
                  >
                    ×
                  </button>
                </div>

                <fieldset className="preference-group">
                  <legend>Appearance</legend>
                  <div className="preference-options" role="group" aria-label="Appearance mode">
                    {['light', 'dark', 'system'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        className={'preference-option ' + (appearance === mode ? 'preference-option--selected' : '')}
                        aria-pressed={appearance === mode}
                        onClick={() => setAppearance(mode)}
                      >
                        {mode[0].toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="preference-help">System follows your device appearance setting.</p>
                </fieldset>

                <div className="preference-group">
                  <span className="preference-group__label">Accessibility</span>
                  <div className="preference-options preference-options--stacked">
                    <button
                      type="button"
                      className={'preference-option preference-option--wide ' + (largeText ? 'preference-option--selected' : '')}
                      aria-pressed={largeText}
                      onClick={() => setLargeText(value => !value)}
                    >
                      <span aria-hidden="true">A+</span>
                      <span>Large text</span>
                    </button>
                    <button
                      type="button"
                      className={'preference-option preference-option--wide ' + (highContrast ? 'preference-option--selected' : '')}
                      aria-pressed={highContrast}
                      onClick={() => setHighContrast(value => !value)}
                    >
                      <span aria-hidden="true">◑</span>
                      <span>High contrast</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Accessibility toolbar — fixed position */}
      <div className="a11y-toolbar" role="group" aria-label="Accessibility options" hidden>
        <button
          className={`a11y-btn ${largeText ? 'a11y-btn--active' : ''}`}
          onClick={() => setLargeText(t => !t)}
          aria-pressed={largeText}
          id="btn-large-text"
          aria-label="Toggle large text"
          title="Toggle large text"
        >
          <span aria-hidden="true">A+</span>
          <span className="a11y-btn__label">Large text</span>
        </button>
        <button
          className={`a11y-btn ${highContrast ? 'a11y-btn--active' : ''}`}
          onClick={() => setHighContrast(c => !c)}
          aria-pressed={highContrast}
          id="btn-high-contrast"
          aria-label="Toggle high contrast"
          title="Toggle high contrast"
        >
          <span className="a11y-btn__label">High contrast</span>
          ◑
        </button>
      </div>

      {/* Main content */}
      <main id="main-content">
        <EpisodePage />
      </main>
    </>
  )
}

export default App
