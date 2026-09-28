import { useState } from 'react'
import { SourceTag } from './SourceTag'
import { api } from '../api'

/**
 * CheckinCard — tap-scale response card with flagging display
 * Spec: DESIGN.md §4.4–4.5
 *
 * Flagging ONLY shows when the backend confirms a match against the
 * patient's own warning_signs — never client-side inference.
 */
export function CheckinCard({ checkin, episodeId, onRespond, documentLabel, animDelay = 0 }) {
  const [selected, setSelected] = useState(
    checkin.response ? checkin.response.response_value : null
  )
  const [flagResult, setFlagResult] = useState(
    checkin.flagged ? { flagged: true, matched_warning_sign: checkin.matched_warning_sign } : null
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!checkin.response)
  const [textResponse, setTextResponse] = useState('')
  const [error, setError] = useState(null)

  const handleScaleSelect = async (val) => {
    if (submitted || submitting) return
    setSelected(val)
    setSubmitting(true)
    setError(null)

    try {
      const result = await api.respondToCheckin(
        episodeId,
        checkin.checkin_id,
        'scale_1_5',
        val
      )
      setFlagResult(result)
      setSubmitted(true)
      onRespond?.(result)
    } catch (err) {
      setError(err.message || 'Your response could not be saved. Please try again.')
      console.error('Failed to submit check-in response:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleYesNoSelect = async (val) => {
    if (submitted || submitting) return
    setSelected(val)
    setSubmitting(true)
    setError(null)

    try {
      const result = await api.respondToCheckin(
        episodeId,
        checkin.checkin_id,
        'yes_no',
        val
      )
      setFlagResult(result)
      setSubmitted(true)
      onRespond?.(result)
    } catch (err) {
      setError(err.message || 'Your response could not be saved. Please try again.')
      console.error('Failed to submit check-in response:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTextSubmit = async () => {
    if (submitted || submitting || !textResponse.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const result = await api.respondToCheckin(
        episodeId,
        checkin.checkin_id,
        'text',
        textResponse.trim()
      )
      setFlagResult(result)
      setSubmitted(true)
      onRespond?.(result)
    } catch (err) {
      setError(err.message || 'Your response could not be saved. Please try again.')
      console.error('Failed to submit check-in response:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const isFlagged = flagResult?.flagged
  const matchedSign = flagResult?.matched_warning_sign

  return (
    <div
      className={`checkin-card ${isFlagged ? 'checkin-card--flagged' : ''} card-animate card-animate-delay-${Math.min(animDelay, 7)}`}
    >
      {checkin.simulated && (
        <div className="demo-badge" style={{ marginBottom: 'var(--space-3)' }}>
          🎮 Demo: Simulated Day {checkin.scheduled_for_day}
        </div>
      )}

      <span className={`card-kind ${isFlagged ? 'card-kind--warning' : 'card-kind--checkin'}`}>
        <span aria-hidden="true">{isFlagged ? '!' : '?'}</span>
        {isFlagged ? 'Warning' : 'Check-in'}
      </span>
      <p className="checkin-card__question">{checkin.prompt_text}</p>

      {checkin.response_type === 'scale_1_5' && (
        <>
          <div className="scale-buttons" role="group" aria-label="Response scale 1 to 5">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                className={`scale-btn ${selected === val ? 'scale-btn--selected' : ''}`}
                onClick={() => handleScaleSelect(val)}
                disabled={submitted || submitting}
                aria-label={`${val} out of 5`}
                aria-pressed={selected === val}
              >
                {val}
              </button>
            ))}
          </div>
          <div className="scale-labels" aria-hidden="true">
            <span>{checkin.scale_labels?.low || 'No concern'}</span>
            <span>{checkin.scale_labels?.high || 'Very concerned'}</span>
          </div>
        </>
      )}

      {checkin.response_type === 'yes_no' && (
        <div className="scale-buttons" role="group" aria-label="Yes or No response">
          <button
            className={`scale-btn ${selected === true ? 'scale-btn--selected' : ''}`}
            onClick={() => handleYesNoSelect(true)}
            disabled={submitted || submitting}
            aria-label="Yes"
            aria-pressed={selected === true}
          >
            Yes
          </button>
          <button
            className={`scale-btn ${selected === false ? 'scale-btn--selected' : ''}`}
            onClick={() => handleYesNoSelect(false)}
            disabled={submitted || submitting}
            aria-label="No"
            aria-pressed={selected === false}
          >
            No
          </button>
        </div>
      )}

      {checkin.response_type === 'text' && (
        <div className="checkin-text-response">
          <label htmlFor={`checkin-response-${checkin.checkin_id}`} className="form-label">
            Your response <span className="form-label__optional">(optional)</span>
          </label>
          <textarea
            id={`checkin-response-${checkin.checkin_id}`}
            className="form-control form-control--textarea"
            value={textResponse}
            onChange={e => setTextResponse(e.target.value)}
            placeholder="Type your response here…"
            disabled={submitted || submitting}
            style={{
              flex: 1,
              minWidth: 200,
              minHeight: 80,
              padding: 'var(--space-3)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'inherit',
              fontSize: 'var(--text-base)',
              lineHeight: 'var(--line-height-body)',
              resize: 'vertical',
              background: 'var(--color-bg-raised)',
              color: 'var(--color-ink)',
            }}
          />
          <button
            className="btn btn--primary"
            onClick={handleTextSubmit}
            disabled={submitted || submitting || !textResponse.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            Submit
          </button>
        </div>
      )}

      {/* Flagged state — shown only when backend confirms a warning sign match */}
      {submitting && (
        <p className="form-status" role="status" aria-live="polite">Saving your response…</p>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {isFlagged && matchedSign && (
        <div className="flag-alert" role="alert">
          <span className="flag-alert__icon" aria-hidden="true">⚠</span>
          <div className="flag-alert__text">
            This matches a warning sign from your discharge instructions:
            <em className="flag-alert__quote">"{matchedSign}"</em>
            <span className="flag-alert__cta">
              Consider contacting your care provider.
            </span>
          </div>
        </div>
      )}

      <SourceTag sourceField={checkin.source_field} extractedJson={null} documentLabel={documentLabel} />
    </div>
  )
}
