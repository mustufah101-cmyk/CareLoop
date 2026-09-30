import { SourceTag } from './SourceTag'

/**
 * InfoCard — non-actionable informational content
 * Spec: DESIGN.md §4.2
 */
export function InfoCard({ text, sourceField, extractedJson, documentLabel, sourceDocument, animDelay = 0 }) {
  return (
    <div className={`card card--info card-animate card-animate-delay-${Math.min(animDelay, 7)}`}>
      <span className="card-kind card-kind--info"><span aria-hidden="true">i</span>Information</span>
      <p className="info-card__text">{text}</p>
      <SourceTag sourceField={sourceField} extractedJson={extractedJson} documentLabel={documentLabel} documentName={sourceDocument?.file_name} displayText={text} />
    </div>
  )
}
