import { useCallback, useEffect, useState } from 'react'

function normalisePath(path) {
  if (!path) return '/dashboard'
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`
  return withLeadingSlash.replace(/\/+/g, '/').replace(/\/$/, '') || '/dashboard'
}

export function parseHash(hash = '') {
  const rawPath = hash.startsWith('#') ? hash.slice(1) : hash
  const path = normalisePath(rawPath)
  const parts = path.split('/').filter(Boolean).map(part => {
    try { return decodeURIComponent(part) } catch { return part }
  })

  if (parts.length === 0 || parts[0] === 'dashboard') return { name: 'dashboard', path: '/dashboard' }
  if (parts[0] === 'care-journey' && parts.length === 1) return { name: 'care-journey', path: '/care-journey' }
  if (parts[0] === 'care-journey' && parts[1] === 'episode' && parts[2]) {
    return { name: 'episode', episodeId: parts[2], path: `/care-journey/episode/${encodeURIComponent(parts[2])}` }
  }
  if (parts[0] === 'copilot' && parts.length === 1) return { name: 'copilot', path: '/copilot' }
  return { name: 'not-found', path }
}

export function routeHref(path) {
  return `#${normalisePath(path)}`
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', routeHref('/dashboard'))
    const handleHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = useCallback(path => { window.location.hash = normalisePath(path) }, [])
  return { route, navigate }
}
