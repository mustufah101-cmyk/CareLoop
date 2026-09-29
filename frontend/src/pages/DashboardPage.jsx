import { useEffect, useState } from 'react'
import { api } from '../api'
import { DEMO_PATIENT_ID, formatTodayDate, getEpisodeSummary, getMostRecentlyAddedEpisode, getTodayItems } from '../episodeData'
import { routeHref } from '../routing'
import { EpisodeSummaryCard } from '../components/EpisodeSummaryCard'
import { SourceTag } from '../components/SourceTag'

export function DashboardPage() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    api.listEpisodes(DEMO_PATIENT_ID)
      .then(result => { if (active) setEpisodes(Array.isArray(result) ? result : []) })
      .catch(err => { if (active) setError(err.message || 'CareLoop could not load your care journeys. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <PageStatus message="Loading your care overview…" />
  if (error) return <PageError message={error} />

  const recentEpisode = getMostRecentlyAddedEpisode(episodes)
  const todayItems = getTodayItems(episodes)
  const summaries = episodes.map(getEpisodeSummary)
  const flaggedCheckins = summaries.reduce((total, summary) => total + summary.flaggedCheckinCount, 0)
  const recordedCheckins = summaries.reduce((total, summary) => total + summary.completedCheckinCount, 0)
  const recentEpisodes = [...episodes]
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.NEGATIVE_INFINITY
      const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.NEGATIVE_INFINITY
      return bTime - aTime
    })
    .slice(0, 3)

  return (
    <div className="page-shell dashboard-page">
      <div className="page-intro">
        <p className="page-intro__eyebrow">Your care overview</p>
        <h1>Welcome to CareLoop</h1>
        <p>Keep your recorded care journeys, instructions, and check-ins together in one place.</p>
      </div>
      <section className="dashboard-today" aria-labelledby="today-heading">
        <div className="dashboard-today__heading">
          <div>
            <p className="page-intro__eyebrow">Grounded in your recorded care</p>
            <h2 id="today-heading">Today</h2>
          </div>
          <time dateTime={new Date().toISOString().slice(0, 10)}>{formatTodayDate()}</time>
        </div>
        {todayItems.length > 0 ? (
          <div className="dashboard-today__list">
            <p className="dashboard-today__summary">{todayItems.length} appointment{todayItems.length === 1 ? '' : 's'} today</p>
            {todayItems.map(item => (
              <article className="today-item" key={`${item.episode.episode_id}-${item.document.doc_id}`}>
                <span className="card-kind card-kind--info"><span aria-hidden="true">●</span>Appointment</span>
                <h3>{item.episode.appointment_type || 'Appointment'}</h3>
                <p className="today-item__date">{item.time ? `${item.time} · ` : ''}{formatTodayDate(item.date)}</p>
                <p className="today-item__context">From your appointment letter · {item.episode.appointment_type || 'Your care journey'}</p>
                <SourceTag
                  sourceField="appointment_date"
                  extractedJson={item.document.extracted_json}
                  documentLabel="your appointment letter"
                  documentName={item.document.file_name}
                  displayText={item.episode.appointment_type || 'Appointment'}
                />
                <a className="btn btn--secondary" href={routeHref(`/care-journey/episode/${item.episode.episode_id}`)}>View journey</a>
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-today__empty">
            <p>Nothing recorded for today.</p>
            <a className="btn btn--ghost" href={routeHref('/care-journey')}>View your care journeys</a>
          </div>
        )}
      </section>
      {episodes.length === 0 ? (
        <section className="page-empty card" aria-labelledby="dashboard-empty-heading">
          <span className="page-empty__icon" aria-hidden="true">◌</span>
          <h2 id="dashboard-empty-heading">Your care journeys will appear here</h2>
          <p>Start by opening Care Journey and adding a care document to a journey.</p>
          <a className="btn btn--primary" href={routeHref('/care-journey')}>Open Care Journey</a>
        </section>
      ) : (
        <>
          <section className="dashboard-overview" aria-labelledby="overview-heading">
            <h2 id="overview-heading">Care overview</h2>
            <div className="overview-grid">
              <div className="overview-stat"><strong>{episodes.length}</strong><span>Recorded care {episodes.length === 1 ? 'journey' : 'journeys'}</span></div>
              <div className="overview-stat"><strong>{recordedCheckins}</strong><span>Recorded check-ins</span></div>
              {flaggedCheckins > 0 && <div className="overview-stat overview-stat--flagged"><strong>{flaggedCheckins}</strong><span>Flagged check-ins</span></div>}
            </div>
          </section>
          <section className="dashboard-section" aria-labelledby="recent-heading">
            <div className="section-heading-row">
              <div><h2 id="recent-heading">Recent care journeys</h2><p className="text-muted">Your journeys are ordered by the date they were added when that date is available.</p></div>
              <a className="btn btn--ghost" href={routeHref('/care-journey')}>View all journeys</a>
            </div>
            <div className="dashboard-recent-list">
              {recentEpisodes.map(episode => <EpisodeSummaryCard key={episode.episode_id} episode={episode} compact isMostRecent={recentEpisode?.episode_id === episode.episode_id} />)}
            </div>
          </section>

          <section className="dashboard-section dashboard-followup" aria-labelledby="followup-heading">
            <h2 id="followup-heading">Follow-up activity</h2>
            {recordedCheckins > 0 || flaggedCheckins > 0 ? (
              <div className="activity-summary card">
                <span className="card-kind card-kind--checkin"><span aria-hidden="true">?</span>Check-in activity</span>
                <p>{recordedCheckins} completed check-in{recordedCheckins === 1 ? '' : 's'} are recorded across your care journeys.</p>
                {flaggedCheckins > 0 && <p className="activity-summary__flag">{flaggedCheckins} flagged check-in{flaggedCheckins === 1 ? '' : 's'} are recorded. Open the relevant journey to review them.</p>}
                <a className="btn btn--secondary" href={routeHref('/care-journey')}>Review care journeys</a>
              </div>
            ) : (
              <div className="activity-summary card"><p>No completed check-ins are recorded yet.</p><a className="btn btn--secondary" href={routeHref('/care-journey')}>View care journeys</a></div>
            )}
          </section>

          <section className="dashboard-section dashboard-copilot" aria-labelledby="copilot-heading">
            <div className="link-card link-card--copilot">
              <span className="card-kind card-kind--info"><span aria-hidden="true">i</span>Information</span>
              <h2 id="copilot-heading">CareLoop Copilot</h2>
              <p>Find information already recorded in your care history, documents, notes, and check-ins.</p>
              <a className="btn btn--secondary" href={routeHref('/copilot')}>Ask Copilot</a>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export function PageStatus({ message }) {
  return <div className="page-status" role="status" aria-live="polite">{message}</div>
}

export function PageError({ message }) {
  return <div className="page-shell page-error-shell"><div className="card card--flag" role="alert"><h1>We could not load this page</h1><p>{message}</p><a className="btn btn--primary" href={routeHref('/dashboard')}>Back to Dashboard</a></div></div>
}
