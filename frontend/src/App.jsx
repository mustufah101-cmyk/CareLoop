import { useEffect, useState } from 'react'
import './index.css'
import { EpisodePage } from './pages/EpisodePage'

/**
 * CareLoop App Root
 * Handles accessibility toggles at the body level (large text, high contrast)
 */
function App() {
  const [largeText, setLargeText] = useState(false)
  const [highContrast, setHighContrast] = useState(false)

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
        </div>
      </nav>

      {/* Accessibility toolbar — fixed position */}
      <div className="a11y-toolbar" role="group" aria-label="Accessibility options">
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
