import { useEffect, useRef, useState } from 'react'

const MAX_LABEL_LENGTH = 80

export function JourneyCreationDialog({ open, submitting = false, error = null, onCancel, onSubmit }) {
  const [label, setLabel] = useState('')
  const [validationError, setValidationError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0)
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !submitting) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onCancel, submitting])

  if (!open) return null

  const handleSubmit = event => {
    event.preventDefault()
    const trimmedLabel = label.trim()
    if (trimmedLabel.length < 2) {
      setValidationError('Please enter at least 2 characters.')
      inputRef.current?.focus()
      return
    }
    setValidationError(null)
    onSubmit(trimmedLabel)
  }

  const message = validationError || error

  return (
    <div className="journey-dialog-backdrop" role="presentation">
      <div className="journey-dialog" role="dialog" aria-modal="true" aria-labelledby="journey-dialog-title">
        <div className="journey-dialog__header">
          <div><p className="page-intro__eyebrow">Start a care journey</p><h2 id="journey-dialog-title">What is this care for?</h2></div>
          <button className="journey-dialog__close" type="button" onClick={onCancel} disabled={submitting} aria-label="Close start care journey dialog">×</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <label className="form-label" htmlFor="journey-label">Care journey name</label>
          <input ref={inputRef} id="journey-label" className="form-control" type="text" value={label} onChange={event => { setLabel(event.target.value); if (validationError) setValidationError(null) }} placeholder="For example, Knee surgery" maxLength={MAX_LABEL_LENGTH} aria-describedby="journey-label-help journey-label-error" aria-invalid={Boolean(message)} disabled={submitting} />
          <p id="journey-label-help" className="form-hint">Use a short name that will help you recognise this journey later.</p>
          <p className="journey-dialog__count" aria-live="polite">{label.length}/{MAX_LABEL_LENGTH}</p>
          {message && <p id="journey-label-error" className="form-error journey-dialog__error" role="alert">{message}</p>}
          <div className="journey-dialog__actions"><button className="btn btn--secondary" type="button" onClick={onCancel} disabled={submitting}>Cancel</button><button className="btn btn--primary" type="submit" disabled={submitting}>{submitting ? 'Starting…' : 'Start journey'}</button></div>
        </form>
      </div>
    </div>
  )
}
