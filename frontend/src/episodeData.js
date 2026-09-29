export const DEMO_PATIENT_ID = 'demo-patient-001'

export function formatEpisodeDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function getEpisodeSummary(episode) {
  const documents = Array.isArray(episode?.documents) ? episode.documents : []
  const during = Array.isArray(episode?.during) ? episode.during : []
  const checkins = Array.isArray(episode?.checkins) ? episode.checkins : []
  return {
    hasBefore: Boolean(episode?.before),
    hasDuring: during.length > 0,
    hasAfter: Boolean(episode?.after),
    documentCount: documents.length,
    checkinCount: checkins.length,
    completedCheckinCount: checkins.filter(checkin => checkin.response || checkin.simulated).length,
    flaggedCheckinCount: checkins.filter(checkin => checkin.flagged).length,
  }
}

export function getMostRecentlyAddedEpisode(episodes) {
  return [...episodes]
    .filter(episode => episode?.created_at && !Number.isNaN(new Date(episode.created_at).getTime()))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null
}
