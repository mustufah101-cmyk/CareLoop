import { formatEpisodeDate, getEpisodeSummary } from '../episodeData'
import { routeHref } from '../routing'

export function EpisodeSummaryCard({ episode, compact = false, isMostRecent = false }) {
  const summary = getEpisodeSummary(episode)
  const date = formatEpisodeDate(episode.created_at)
  const title = episode.appointment_type || 'Your care journey'

  return (
    <article className={`episode-summary-card ${compact ? 'episode-summary-card--compact' : ''}`}>
      <div className="episode-summary-card__marker" aria-hidden="true">●</div>
      <div className="episode-summary-card__body">
        <p className="episode-summary-card__eyebrow">
          {isMostRecent ? 'Most recently added' : 'Recorded care journey'}
        </p>
        <h3>{title}</h3>
        <p className="episode-summary-card__date">
          {date ? `Added ${date}` : 'Date added not available'}
        </p>

        <div className="episode-summary-card__details" aria-label="Recorded journey details">
          {summary.hasBefore && <span>Before information</span>}
          {summary.hasDuring && <span>Visit notes</span>}
          {summary.hasAfter && <span>After information</span>}
          {summary.documentCount > 0 && <span>{summary.documentCount} {summary.documentCount === 1 ? 'care document' : 'care documents'}</span>}
          {summary.completedCheckinCount > 0 && <span>{summary.completedCheckinCount} completed check-in{summary.completedCheckinCount === 1 ? '' : 's'}</span>}
          {summary.checkinCount > summary.completedCheckinCount && <span>{summary.checkinCount - summary.completedCheckinCount} check-in{summary.checkinCount - summary.completedCheckinCount === 1 ? '' : 's'} not yet answered</span>}
          {summary.flaggedCheckinCount > 0 && <span className="episode-summary-card__flag">{summary.flaggedCheckinCount} flagged check-in{summary.flaggedCheckinCount === 1 ? '' : 's'}</span>}
        </div>

        <a className="btn btn--secondary" href={routeHref(`/care-journey/episode/${episode.episode_id}`)}>
          View journey
        </a>
      </div>
    </article>
  )
}
