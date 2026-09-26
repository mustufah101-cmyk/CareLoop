import { useState } from 'react'
import './index.css'
import { EpisodePage } from './pages/EpisodePage'

/**
 * CareLoop App Root
 * Handles accessibility toggles at the body level (large text, high contrast)
 */
function App() {
  const [largeText, setLargeText] = useState(false)
  const [highContrast, setHighContrast] = useState(false)

  // Apply a11y classes to body
  const bodyClasses = [
    largeText ? 'a11y-large-text' : '',
    highContrast ? 'a11y-high-contrast' : '',
  ].filter(Boolean).join(' ')

  if (typeof document !== 'undefined') {
    document.body.className = bodyClasses
  }

  return (
    <>
      {/* Navigation */}
      <nav className="nav" aria-label="CareLoop navigation">
        <div className="nav__inner">
          <a href="/" className="nav__logo" aria-label="CareLoop home">
            CareLoop
          </a>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-muted)' }}>
              Accessibility:
            </span>
          </div>
        </div>
      </nav>

      {/* Accessibility toolbar — fixed position */}
      <div className="a11y-toolbar" role="group" aria-label="Accessibility options">
        <button
          className={`a11y-btn ${largeText ? 'a11y-btn--active' : ''}`}
          onClick={() => setLargeText(t => !t)}
          aria-pressed={largeText}
          id="btn-large-text"
        >
          A+
        </button>
        <button
          className={`a11y-btn ${highContrast ? 'a11y-btn--active' : ''}`}
          onClick={() => setHighContrast(c => !c)}
          aria-pressed={highContrast}
          id="btn-high-contrast"
          aria-label="Toggle high contrast"
        >
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
