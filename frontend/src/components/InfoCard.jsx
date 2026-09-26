import { SourceTag } from './SourceTag'

/**
 * InfoCard — non-actionable informational content
 * Spec: DESIGN.md §4.2
 */
export function InfoCard({ text, sourceField, extractedJson, animDelay = 0 }) {
  // For patient_note source, we don't have extractedJson
  const showSourceTag = sourceField !== 'patient_note'

  return (
    <div className={`card card--info card-animate card-animate-delay-${Math.min(animDelay, 7)}`}>
      <p style={{ marginBottom: 'var(--space-3)' }}>{text}</p>
      {showSourceTag && (
        <SourceTag sourceField={sourceField} extractedJson={extractedJson} />
      )}
    </div>
  )
}
