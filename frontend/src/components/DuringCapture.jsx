import { useState } from 'react'
import { api } from '../api'

/**
 * DuringCapture — UI for capturing notes during the appointment
 * Spec: DESIGN.md §4.3 (P1 feature)
 *
 * Allows patient to type notes or will later support photo capture of handouts.
 */
export function DuringCapture({ episodeId, onCaptureComplete }) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!notes.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const result = await api.captureDuringNote(episodeId, notes)
      setNotes('')
      onCaptureComplete?.(result)
    } catch (err) {
      setError(err.message || 'Failed to save notes. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="capture-form">
        <label htmlFor="during-notes" className="form-label">
          What did the clinician say? Any handouts or instructions?
        </label>
        <textarea
          id="during-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Type your notes here… e.g. 'Doctor said take new pills twice a day with food, no driving for a week. Got a handout about wound care.'"
          className="form-control form-control--textarea"
          disabled={submitting}
          aria-describedby="during-notes-hint"
        />
        <p id="during-notes-hint" className="form-hint">
          Write in your own words. We'll organise this into a clear summary for your timeline.
        </p>
        {error && (
          <div role="alert" style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-flag-bg)', borderLeft: '3px solid var(--color-flag)', borderRadius: 'var(--radius-sm)', color: 'var(--color-flag)' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !notes.trim()}
            style={{ minWidth: 160 }}
          >
            {submitting ? 'Saving…' : 'Save visit notes'}
          </button>
        </div>
      </form>

    </div>
  )
}
