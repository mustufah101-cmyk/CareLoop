import { useId, useState } from 'react'
import { routeHref } from '../routing'

const sourceKinds = {
  clinician_document: { label: 'Clinician source', icon: '▤' },
  patient_note: { label: 'Your visit note', icon: '✎' },
  episode_metadata: { label: 'Recorded care journey', icon: '◉' },
  checkin: { label: 'Check-in history', icon: '✓' },
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Not specified'
  if (Array.isArray(value)) return value.map(displayValue).join('; ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key, item]) => item !== null && item !== '' && item !== undefined && !['flagging_criteria', 'scale_labels'].includes(key))
      .map(([key, item]) => `${friendlyFieldLabel(key)}: ${displayValue(item)}`)
      .join('; ')
  }
  return String(value)
}

const fieldLabels = {
  created_at: 'Date added',
  appointment_type: 'Care journey type',
  appointment_date: 'Appointment date',
  appointment_time: 'Appointment time',
  scheduled_for_day: 'Scheduled day',
  prompt_text: 'Check-in question',
  response: 'Recorded response',
  response_value: 'Recorded response',
  matched_warning_sign: 'Matched care instruction',
  activity_restrictions: 'Activity instructions',
  warning_signs: 'Warning signs',
  follow_up: 'Follow-up information',
  checkins: 'Check-in history',
}

function friendlyFieldLabel(field) {
  const rootField = field?.split(/[.[]/, 1)[0] || ''
  return fieldLabels[rootField] || rootField.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function displayEvidence(citation) {
  if (citation.source_field === 'created_at' && typeof citation.evidence_value === 'string') {
    const parsed = new Date(citation.evidence_value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    }
  }
  return displayValue(citation.evidence_value)
}

export function CopilotCitation({ citation }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const source = sourceKinds[citation.source_type] || { label: 'Recorded CareLoop source', icon: '•' }
  const wording = citation.is_verbatim ? 'Recorded text' : 'Recorded information'

  return (
    <div className="copilot-citation">
      <button
        className="copilot-citation__toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(open => !open)}
      >
        <span className="copilot-citation__icon" aria-hidden="true">{source.icon}</span>
        <span className="copilot-citation__label">{citation.source_label || source.label}</span>
        <span className="copilot-citation__kind">{wording}</span>
        <span className="copilot-citation__chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </button>
      {expanded && (
        <div className="copilot-citation__details" id={contentId}>
          <p className="copilot-citation__detail-label">{wording}</p>
          <p>{displayEvidence(citation)}</p>
          {citation.file_name && <p className="copilot-citation__file">Document: {citation.file_name}</p>}
          <p className="copilot-citation__field">{friendlyFieldLabel(citation.source_field)}</p>
          {citation.episode_id && (
            <a className="copilot-citation__journey-link" href={routeHref(`/care-journey/episode/${encodeURIComponent(citation.episode_id)}`)}>
              View care journey
            </a>
          )}
        </div>
      )}
    </div>
  )
}
