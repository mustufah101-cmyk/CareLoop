import { useEffect, useId, useRef, useState } from 'react'

/**
 * SourceTag — shown on every patient-facing element (non-negotiable per GEMINI.md)
 * Tapping reveals the original extracted field verbatim.
 */
const fieldLabels = {
  appointment_type: 'Appointment type',
  appointment_date: 'Appointment date',
  appointment_time: 'Arrival time',
  items_to_bring: 'Items to bring',
  preparation_requirements: 'Preparation instructions',
  activity_restrictions: 'Activity instructions',
  medications: 'Medication information',
  medication_holds: 'Medication instructions',
  action_items: 'Action items',
  follow_up: 'Follow-up information',
  warning_signs: 'Warning signs',
  patient_note: 'Visit note',
  checkins: 'Check-in',
}

const sourceKinds = {
  patient_note: { label: 'From your visit note', category: 'Patient-entered note', icon: '✎' },
  checkins: { label: 'From your check-in', category: 'Check-in record', icon: '✓' },
}

function readableFieldLabel(sourceField) {
  const rootField = sourceField?.split(/[.[]/, 1)[0]
  return fieldLabels[rootField] || 'Recorded information'
}

function readableValue(value) {
  if (value === null || value === undefined || value === '') return 'Not specified'
  if (Array.isArray(value)) return value.map(readableValue).join('; ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== '' && item !== undefined)
      .map(([key, item]) => `${key.replaceAll('_', ' ')}: ${readableValue(item)}`)
      .join('; ')
  }
  return String(value)
}

export function SourceTag({ sourceField, extractedJson, documentLabel = 'your care document', documentName, displayText, isVerbatim = false, whyLabel = 'Why am I seeing this?' }) {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  const triggerRef = useRef(null)
  const contentRef = useRef(null)

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
      return val != null ? val : null
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (open) contentRef.current?.focus()
    else if (document.activeElement === contentRef.current) triggerRef.current?.focus()
  }, [open])

  const sourceKind = sourceKinds[sourceField] || {
    label: 'From ' + documentLabel,
    category: 'Clinician-provided document',
    icon: '▤',
  }
  const sourceText = sourceField ? sourceKind.label : 'Why am I seeing this?'
  const fieldLabel = sourceField ? readableFieldLabel(sourceField) : 'Source information'
  const fieldValue = getFieldValue()
  const evidenceLabel = isVerbatim ? 'Recorded text' : 'Recorded information'
  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  return (
    <div className="source-popover">
      <button
        type="button"
        className="source-tag"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        ref={triggerRef}
        aria-label={whyLabel + '. See why this appears in your care plan.'}
      >
        <span>{sourceField ? whyLabel : sourceText}</span>
        <span className="source-tag__icon" aria-hidden="true">›</span>
      </button>
      {open && (
        <div className="source-popover__content" id={contentId} role="dialog" aria-modal="false" aria-labelledby={`${contentId}-title`} tabIndex="-1" ref={contentRef} onKeyDown={handleKeyDown}>
          <div className="source-popover__header">
            <strong className="source-popover__title" id={`${contentId}-title`}>Why you're seeing this</strong>
            <button type="button" className="source-popover__close" onClick={() => { setOpen(false); triggerRef.current?.focus() }} aria-label="Close source details">×</button>
          </div>
          <span className="source-popover__document"><strong>Source</strong>{sourceText}</span>
          {documentName && <span className="source-popover__filename"><strong>Document</strong>{documentName}</span>}
          <span className="source-popover__field"><strong>CareLoop found</strong>{fieldLabel}</span>
          <span className="source-popover__kind"><strong>{evidenceLabel}</strong>{sourceKind.category}</span>
          {fieldValue !== null && fieldValue !== undefined
            ? <span className="source-popover__value"><strong>Recorded information</strong>{readableValue(fieldValue)}</span>
            : sourceField
              ? <span className="source-popover__value source-popover__value--missing"><strong>Not specified</strong>CareLoop does not have this source detail available.</span>
              : <span className="source-popover__value source-popover__value--missing"><strong>Not specified</strong>This item does not have source information attached. CareLoop won't guess missing information.</span>
          }
          {displayText && <span className="source-popover__used"><strong>Used in your care plan as</strong>{displayText}</span>}
        </div>
      )}
    </div>
  )
}
