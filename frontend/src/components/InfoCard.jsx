import { SourceTag } from './SourceTag'

/**
 * InfoCard — non-actionable informational content
 * Spec: DESIGN.md §4.2
 */
export function InfoCard({ text, sourceField, extractedJson, documentLabel, animDelay = 0 }) {
  // For patient_note source, we don't have extractedJson
  const showSourceTag = sourceField !== 'patient_note'

  return (
    <div className={`card card--info card-animate card-animate-delay-${Math.min(animDelay, 7)}`}>
      <span className="card-kind card-kind--info"><span aria-hidden="true">i</span>Information</span>
      <p className="info-card__text">{text}</p>
      {showSourceTag && (
        <SourceTag sourceField={sourceField} extractedJson={extractedJson} documentLabel={documentLabel} />
      )}
    </div>
  )
}
