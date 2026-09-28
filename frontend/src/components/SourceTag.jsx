import { useId, useState } from 'react'

/**
 * SourceTag — shown on every patient-facing element (non-negotiable per GEMINI.md)
 * Tapping reveals the original extracted field verbatim.
 */
export function SourceTag({ sourceField, extractedJson, documentLabel = 'your care document' }) {
  const [open, setOpen] = useState(false)
  const contentId = useId()

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
  const sourceText = 'From ' + documentLabel

  return (
    <div className="source-popover">
      <button
        type="button"
        className="source-tag"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={sourceText + '. View the original extracted source information.'}
      >
        <span>{sourceText}</span>
        <span className="source-tag__icon" aria-hidden="true">›</span>
      </button>
      {open && (
        <div className="source-popover__content" id={contentId} role="region" aria-label="Original source information">
          <strong className="source-popover__title">
            Original source information
          </strong>
          <span className="source-popover__document">{sourceText}</span>
          <span className="source-popover__field">Source field: {sourceField}</span>
          {fieldValue
            ? <code className="source-popover__value">{fieldValue}</code>
            : <em style={{ opacity: 0.7 }}>Field value not available for preview</em>
          }
        </div>
      )}
    </div>
  )
}
