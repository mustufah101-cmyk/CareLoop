import { useState, useRef } from 'react'
import { api } from '../api'

/**
 * DocumentUpload — drag-drop + file picker + processing state
 * Spec: DESIGN.md §4.6
 *
 * The hero animation (timeline populating) happens after this
 * completes and the parent re-renders with real data.
 */
export function DocumentUpload({ episodeId, onUploadComplete, label }) {
  const [state, setState] = useState('idle') // idle | drag | processing | error
  const [errorMessage, setErrorMessage] = useState(null)
  const [processingLabel, setProcessingLabel] = useState('Reading your document…')
  const fileInputRef = useRef(null)

  const processFile = async (file) => {
    if (!file) return

    setState('processing')
    setProcessingLabel('Reading your document…')
    setErrorMessage(null)

    // Simulate progress stages for UX
    const stages = [
      'Reading your document…',
      'Extracting key information…',
      'Building your care plan…',
    ]
    let stageIdx = 0
    const interval = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1)
      setProcessingLabel(stages[stageIdx])
    }, 1800)

    try {
      const result = await api.uploadDocument(episodeId, file)
      clearInterval(interval)
      setState('idle')
      onUploadComplete?.(result)
    } catch (err) {
      clearInterval(interval)
      setState('error')
      const msg =
        err.data?.detail?.message ||
        err.data?.message ||
        (typeof err.data?.detail === 'string' ? err.data.detail : null) ||
        err.message ||
        'Something went wrong. Please try again.'
      setErrorMessage(msg)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setState('idle')
    const file = e.dataTransfer.files[0]
    processFile(file)
  }

  const handleFileChange = (e) => {
    processFile(e.target.files[0])
  }

  if (state === 'processing') {
    return (
      <div className="processing-state" role="status" aria-live="polite">
        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: 'var(--space-3)' }}>📄</span>
        <p style={{ fontWeight: 500, marginBottom: 'var(--space-2)' }}>{processingLabel}</p>
        <div className="processing-bar" aria-hidden="true">
          <div className="processing-bar__fill" />
        </div>
        <p className="text-muted">This usually takes 10–20 seconds</p>
      </div>
    )
  }

  return (
    <div>
      <div
        className={`upload-zone ${state === 'drag' ? 'upload-zone--drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setState('drag') }}
        onDragLeave={() => setState('idle')}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label={`Upload a file: ${label || 'Drop a document or tap to browse'}`}
      >
        <span className="upload-zone__icon" aria-hidden="true">📁</span>
        <span className="upload-zone__label">
          {label || 'Drop a file or tap to upload'}
        </span>
        <span className="upload-zone__hint">PDF, photo (JPEG/PNG), or text file</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {state === 'error' && errorMessage && (
        <div
          role="alert"
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-flag-bg)',
            borderLeft: '3px solid var(--color-flag)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-flag)',
          }}
        >
          <strong>Upload issue:</strong> {errorMessage}
        </div>
      )}
    </div>
  )
}
