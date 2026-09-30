import { useEffect, useState } from 'react'
import { api } from '../api'
import { DEMO_PATIENT_ID } from '../episodeData'
import { routeHref } from '../routing'
import { PageError, PageStatus } from './DashboardPage'
import { EpisodeSummaryCard } from '../components/EpisodeSummaryCard'
import { JourneyCreationDialog } from '../components/JourneyCreationDialog'

export function CareJourneyPage() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creationOpen, setCreationOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [creationError, setCreationError] = useState(null)

  useEffect(() => {
    let active = true
    api.listEpisodes(DEMO_PATIENT_ID)
      .then(result => { if (active) setEpisodes(Array.isArray(result) ? result : []) })
      .catch(err => { if (active) setError(err.message || 'CareLoop could not load your care journeys. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const openCreation = () => {
    setCreationError(null)
    setCreationOpen(true)
  }

  const cancelCreation = () => {
    if (!creating) setCreationOpen(false)
  }

  const createJourney = async label => {
    setCreating(true)
    setCreationError(null)
    try {
      const episode = await api.createEpisode(DEMO_PATIENT_ID, label)
      window.location.hash = routeHref(`/care-journey/episode/${episode.episode_id}`).slice(1)
    } catch (err) {
      setCreationError(err.message || 'CareLoop could not start a new care journey. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <PageStatus message="Loading your care journeys…" />
  if (error && episodes.length === 0) return <PageError message={error} />

  const episodesByYear = [...episodes]
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.NEGATIVE_INFINITY
      const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.NEGATIVE_INFINITY
      return bTime - aTime
    })
    .reduce((groups, episode) => {
      const date = episode.created_at ? new Date(episode.created_at) : null
      const year = date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : 'Date not available'
      if (!groups[year]) groups[year] = []
      groups[year].push(episode)
      return groups
    }, {})

  return (
    <div className="page-shell care-journey-page">
      <div className="page-intro page-intro--with-action"><div><p className="page-intro__eyebrow">Your recorded care</p><h1>Care Journey</h1><p>Open a recorded journey to see its Before, During, After, and Check-ins timeline.</p></div><button className="btn btn--primary" type="button" onClick={openCreation}>Start a new care journey</button></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {episodes.length === 0 ? (
        <section className="page-empty card" aria-labelledby="journey-empty-heading"><span className="page-empty__icon" aria-hidden="true">◌</span><h2 id="journey-empty-heading">No care journeys recorded yet</h2><p>Start a journey when you are ready. Your uploaded care documents and recorded visit notes will appear inside it.</p><button className="btn btn--secondary" type="button" onClick={openCreation}>Start your first care journey</button></section>
      ) : (
        <div className="longitudinal-history" aria-label="Recorded care journeys">
          {Object.entries(episodesByYear).map(([year, yearEpisodes]) => (
            <section className="journey-year-group" key={year} aria-labelledby={`journey-year-${year.replace(/\s/g, '-')}`}>
              <h2 id={`journey-year-${year.replace(/\s/g, '-')}`}>{year === 'Date not available' ? year : `Added in ${year}`}</h2>
              <div className="journey-history-list">
                {yearEpisodes.map(episode => <EpisodeSummaryCard key={episode.episode_id} episode={episode} />)}
              </div>
            </section>
          ))}
        </div>
      )}
      <JourneyCreationDialog key={creationOpen ? 'open' : 'closed'} open={creationOpen} submitting={creating} error={creationError} onCancel={cancelCreation} onSubmit={createJourney} />
    </div>
  )
}
