import { useState } from 'react'
import { api } from '../api'

/**
 * DuringCapture — UI for capturing notes during the appointment
 * Spec: DESIGN.md §4.3 (P1 feature)
 *
 * Allows patient to type notes or will later support photo capture of handouts.
 */
export function DuringCapture({
  episodeId,
  onCaptureComplete,
  questionId,
  questionText,
  idPrefix = 'during-notes',
  label = 'What did you record during the visit?',
  hint = "Write in your own words. CareLoop will keep this as a patient-entered visit note.",
  submitLabel = 'Save visit notes',
}) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!notes.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const result = await api.captureDuringNote(episodeId, notes, questionId, questionText)
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
        <label htmlFor={`${idPrefix}-notes`} className="form-label">
          {label}
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Type what you remember here…"
          className="form-control form-control--textarea"
          disabled={submitting}
          aria-describedby={`${idPrefix}-hint`}
        />
        <p id={`${idPrefix}-hint`} className="form-hint">
          {hint}
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
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>

    </div>
  )
}
