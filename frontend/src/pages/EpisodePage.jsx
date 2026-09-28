import { useState, useEffect } from 'react'
import { Timeline } from '../components/Timeline'
import { api } from '../api'

/**
 * EpisodePage — main page showing a single care episode
 *
 * In the hackathon build, we use a fixed demo patient ID.
 * The page creates an episode on first load if none exists.
 */
const DEMO_PATIENT_ID = 'demo-patient-001'

export function EpisodePage() {
  const [episode, setEpisode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadOrCreateEpisode()
  }, [])

  const loadOrCreateEpisode = async () => {
    setLoading(true)
    setError(null)
    try {
      // Check for existing episodes
      const episodes = await api.listEpisodes(DEMO_PATIENT_ID)
      if (episodes.length > 0) {
        setEpisode(episodes[0])
      } else {
        // Create a fresh episode for demo
        const newEpisode = await api.createEpisode(DEMO_PATIENT_ID)
        setEpisode(newEpisode)
      }
    } catch (err) {
      setError(err.message || 'CareLoop could not load your care journey. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleNewEpisode = async () => {
    setLoading(true)
    try {
      const newEpisode = await api.createEpisode(DEMO_PATIENT_ID)
      setEpisode(newEpisode)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-4)' }}>⏳</div>
          <p style={{ color: 'var(--color-ink-muted)' }}>Loading your care journey…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 520, margin: '80px auto', padding: 'var(--space-6)' }}>
        <div className="card card--flag">
          <h2 style={{ fontFamily: 'var(--font-headline)', marginBottom: 'var(--space-3)' }}>
            Connection error
          </h2>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-ink-muted)' }}>
            {error}
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-muted)' }}>
            Please check that CareLoop is available, then try again.
          </p>
          <button
            className="btn btn--primary"
            onClick={loadOrCreateEpisode}
            style={{ marginTop: 'var(--space-4)' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {episode && (
        <Timeline
          episode={episode}
          onEpisodeUpdate={setEpisode}
        />
      )}

      {/* New episode button */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: 'var(--space-4)', textAlign: 'right' }}>
        <button className="btn btn--ghost" onClick={handleNewEpisode} style={{ fontSize: 'var(--text-sm)' }}>
          + Start a new episode
        </button>
      </div>
    </div>
  )
}
