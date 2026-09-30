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

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseExplicitCalendarDate(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value.trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null
  return date
}

export function formatTodayDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

export function getTodayItems(episodes, today = new Date()) {
  const todayKey = localDateKey(today)
  const items = []

  for (const episode of episodes || []) {
    const appointmentDocument = (episode.documents || []).find(document => {
      if (document.doc_type !== 'appointment_letter') return false
      return parseExplicitCalendarDate(document.extracted_json?.appointment_date)
    })
    if (!appointmentDocument) continue

    const appointmentDate = parseExplicitCalendarDate(appointmentDocument.extracted_json.appointment_date)
    if (localDateKey(appointmentDate) !== todayKey) continue
    items.push({
      type: 'appointment',
      episode,
      date: appointmentDate,
      time: appointmentDocument.extracted_json.appointment_time || null,
      document: appointmentDocument,
    })
  }

  return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
}
