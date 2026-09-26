import { useState, useRef } from 'react'

/**
 * SourceTag — shown on every patient-facing element (non-negotiable per GEMINI.md)
 * Tapping reveals the original extracted field verbatim.
 */
export function SourceTag({ sourceField, extractedJson }) {
  const [open, setOpen] = useState(false)

  // Try to pull the referenced field value from the extracted JSON
  const getFieldValue = () => {
    if (!extractedJson || !sourceField) return null
    // Support dot notation and array notation: "medications[0]", "follow_up[1].timeframe"
    try {
      const parts = sourceField.replace(/\[(\d+)\]/g, '.$1').split('.')
      let val = extractedJson
      for (const p of parts) {
        if (val == null) return null
        val = val[p]
      }
      return val != null ? JSON.stringify(val, null, 2) : null
    } catch {
      return null
    }
  }

  const fieldValue = getFieldValue()

  // Don't show source tag if we have no way to display the source
  if (!sourceField) return null

  return (
    <div className="source-popover">
      <button
        className="source-tag"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`Source: ${sourceField}. Tap to view original extracted field.`}
      >
        <span>Source: {sourceField}</span>
        <span className="source-tag__icon" aria-hidden="true">›</span>
      </button>
      {open && (
        <div className="source-popover__content" role="tooltip">
          <strong style={{ display: 'block', marginBottom: '4px', opacity: 0.7, fontSize: '0.8em' }}>
            Extracted from: {sourceField}
          </strong>
          {fieldValue
            ? <code style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{fieldValue}</code>
            : <em style={{ opacity: 0.7 }}>Field value not available for preview</em>
          }
        </div>
      )}
    </div>
  )
}
