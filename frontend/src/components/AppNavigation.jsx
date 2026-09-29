import { useState } from 'react'
import { routeHref } from '../routing'

const primaryLinks = [
  { name: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { name: 'care-journey', label: 'Care Journey', path: '/care-journey' },
  { name: 'copilot', label: 'Copilot', path: '/copilot' },
]

function NavigationLink({ link, route, mobile = false }) {
  const active = route.name === link.name || (link.name === 'care-journey' && route.name === 'episode')
  return (
    <a
      className={mobile ? 'mobile-nav__link' : 'primary-nav__link'}
      href={routeHref(link.path)}
      aria-current={active ? 'page' : undefined}
    >
      {link.label}
    </a>
  )
}

export function AppNavigation({ route, appearance, setAppearance, largeText, setLargeText, highContrast, setHighContrast }) {
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  return (
    <>
      <nav className="nav" aria-label="CareLoop navigation">
        <div className="nav__inner">
          <a href={routeHref('/dashboard')} className="nav__logo" aria-label="CareLoop dashboard">CareLoop</a>
          <div className="primary-nav" aria-label="Primary navigation">
            {primaryLinks.map(link => <NavigationLink key={link.name} link={link} route={route} />)}
          </div>
          <div className="nav__context"><span className="nav__context-label">Accessible care, kept together</span></div>
          <div className="appearance-control">
            <button className="appearance-toggle" type="button" aria-expanded={preferencesOpen} aria-controls="appearance-panel" onClick={() => setPreferencesOpen(open => !open)}>
              <span aria-hidden="true">☼</span><span>Accessibility &amp; appearance</span>
            </button>
            {preferencesOpen && (
              <div className="appearance-panel" id="appearance-panel" role="dialog" aria-label="Accessibility and appearance settings">
                <div className="appearance-panel__header">
                  <h2>Accessibility and appearance</h2>
                  <button className="appearance-panel__close" type="button" onClick={() => setPreferencesOpen(false)} aria-label="Close accessibility and appearance settings">×</button>
                </div>
                <fieldset className="preference-group">
                  <legend>Appearance</legend>
                  <div className="preference-options" role="group" aria-label="Appearance mode">
                    {['light', 'dark', 'system'].map(mode => (
                      <button key={mode} type="button" className={'preference-option ' + (appearance === mode ? 'preference-option--selected' : '')} aria-pressed={appearance === mode} onClick={() => setAppearance(mode)}>
                        {mode[0].toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="preference-help">System follows your device appearance setting.</p>
                </fieldset>
                <div className="preference-group">
                  <span className="preference-group__label">Accessibility</span>
                  <div className="preference-options preference-options--stacked">
                    <button type="button" className={'preference-option preference-option--wide ' + (largeText ? 'preference-option--selected' : '')} aria-pressed={largeText} onClick={() => setLargeText(value => !value)}><span aria-hidden="true">A+</span><span>Large text</span></button>
                    <button type="button" className={'preference-option preference-option--wide ' + (highContrast ? 'preference-option--selected' : '')} aria-pressed={highContrast} onClick={() => setHighContrast(value => !value)}><span aria-hidden="true">◑</span><span>High contrast</span></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
      <nav className="mobile-nav" aria-label="Mobile primary navigation">
        {primaryLinks.map(link => <NavigationLink key={link.name} link={link} route={route} mobile />)}
      </nav>
    </>
  )
}
