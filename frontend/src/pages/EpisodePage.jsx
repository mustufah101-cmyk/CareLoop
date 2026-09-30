import { useCallback, useEffect, useState } from 'react'
import { Timeline } from '../components/Timeline'
import { api } from '../api'
import { DEMO_PATIENT_ID, formatEpisodeDate } from '../episodeData'
import { routeHref } from '../routing'
import { JourneyCreationDialog } from '../components/JourneyCreationDialog'

/** EpisodePage — the existing detailed Before → During → After → Check-ins journey. */
export function EpisodePage({ episodeId }) {
  const [episode, setEpisode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creationOpen, setCreationOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [creationError, setCreationError] = useState(null)

  const loadEpisode = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      if (episodeId) {
        setEpisode(await api.getEpisode(episodeId))
      } else {
        const episodes = await api.listEpisodes(DEMO_PATIENT_ID)
        if (episodes.length === 0) throw new Error('No care journey is selected yet.')
        setEpisode(episodes[0])
      }
    } catch (err) {
      setError(err.message || 'CareLoop could not load this care journey. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [episodeId])

  useEffect(() => { loadEpisode() }, [loadEpisode])

  const openCreation = () => {
    setCreationError(null)
    setCreationOpen(true)
  }

  const cancelCreation = () => {
    if (!creating) setCreationOpen(false)
  }

  const handleNewEpisode = async label => {
    setCreating(true)
    setCreationError(null)
    try {
      const newEpisode = await api.createEpisode(DEMO_PATIENT_ID, label)
      window.location.hash = routeHref(`/care-journey/episode/${newEpisode.episode_id}`).slice(1)
    } catch (err) {
      setCreationError(err.message || 'CareLoop could not start a new care journey. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="page-status" role="status" aria-live="polite">Loading your care journey…</div>
  }

  if (error) {
    return (
      <div className="page-shell page-error-shell">
        <div className="card card--flag" role="alert">
          <h1>We could not load this care journey</h1>
          <p>{error}</p>
          <p className="text-muted">Please check that CareLoop is available, then try again.</p>
          <div className="page-error-shell__actions">
            <a className="btn btn--secondary" href={routeHref('/care-journey')}>Back to Care Journey</a>
            <button className="btn btn--primary" type="button" onClick={() => loadEpisode(true)}>Try again</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="episode-detail-toolbar">
        <a className="episode-back-link" href={routeHref('/care-journey')}>← Back to Care Journey</a>
        {formatEpisodeDate(episode?.created_at) && <span className="text-muted">Added {formatEpisodeDate(episode.created_at)}</span>}
      </div>
      {episode && <Timeline episode={episode} onEpisodeUpdate={setEpisode} />}
      <div className="episode-footer-action">
        <button className="btn btn--ghost" type="button" onClick={openCreation}>+ Start a new care journey</button>
      </div>
      <JourneyCreationDialog
        key={creationOpen ? 'open' : 'closed'}
        open={creationOpen}
        submitting={creating}
        error={creationError}
        onCancel={cancelCreation}
        onSubmit={handleNewEpisode}
      />
    </div>
  )
}
