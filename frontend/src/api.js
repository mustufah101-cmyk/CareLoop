/**
 * CareLoop API client
 * All fetch calls go through here — proxy routes to http://localhost:8000
 */

const BASE = '/api'

async function request(path, options = {}) {
  const headers = { ...options.headers }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    let message = 'Request failed'
    if (typeof err.detail === 'string') {
      message = err.detail
    } else if (Array.isArray(err.detail)) {
      message = err.detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
    } else if (err.message) {
      message = err.message
    } else if (err.detail && typeof err.detail === 'object') {
      message = JSON.stringify(err.detail)
    }
    throw Object.assign(new Error(message), { status: res.status, data: err })
  }

  if (res.status === 204) return null
  return res.json()
}

// ── Episodes ─────────────────────────────────────────────────────────────────

export const api = {
  createEpisode: (patientId, appointmentType) =>
    request('/episodes', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, appointment_type: appointmentType }),
    }),

  getEpisode: (episodeId) => request(`/episodes/${episodeId}`),

  listEpisodes: (patientId) => request(`/episodes?patient_id=${encodeURIComponent(patientId)}`),

  // ── Documents ─────────────────────────────────────────────────────────────

  uploadDocument: (episodeId, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/episodes/${episodeId}/documents`, {
      method: 'POST',
      body: form,
      headers: {}, // Let browser set multipart boundary
    })
  },

  getDocument: (episodeId, docId) =>
    request(`/episodes/${episodeId}/documents/${docId}`),

  // ── Check-ins ─────────────────────────────────────────────────────────────

  listCheckins: (episodeId) => request(`/episodes/${episodeId}/checkins`),

  respondToCheckin: (episodeId, checkinId, responseType, responseValue) =>
    request(`/episodes/${episodeId}/checkins/${checkinId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response_type: responseType, response_value: responseValue }),
    }),

  simulateDay: (episodeId, day) =>
    request(`/episodes/${episodeId}/checkins/simulate`, {
      method: 'POST',
      body: JSON.stringify({ day, demo_mode: true }),
    }),

  // ── During-flow ───────────────────────────────────────────────────────────

  captureDuringNote: (episodeId, notes) =>
    request(`/episodes/${episodeId}/during`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  getDuringNotes: (episodeId) => request(`/episodes/${episodeId}/during`),
}
