import { useState } from 'react'
import { SourceTag } from './SourceTag'

/**
 * ActionItem — a checkable prep/recovery instruction
 * Spec: DESIGN.md §4.1
 */
export function ActionItem({ item, timing, category, done: initialDone, sourceField, extractedJson, sourceLabel, sourceDocument, animDelay = 0 }) {
  const [done, setDone] = useState(initialDone || false)
  const id = `action-${Math.random().toString(36).slice(2)}`

  return (
    <div
      className={`action-item card-animate card-animate-delay-${Math.min(animDelay, 7)} ${done ? 'action-item--done' : ''}`}
    >
      <input
        type="checkbox"
        className="action-item__checkbox"
        id={id}
        checked={done}
        onChange={() => setDone(d => !d)}
        aria-label={item}
      />
      <div className="action-item__text">
        <span className="card-kind card-kind--action"><span aria-hidden="true">→</span>Action</span>
        <label className="action-item__label" htmlFor={id}>
          {item}
        </label>
        {timing && (
          <span className="action-item__timing">⏰ {timing}</span>
        )}
        <SourceTag sourceField={sourceField} extractedJson={extractedJson} documentLabel={sourceLabel} documentName={sourceDocument?.file_name} displayText={item} />
      </div>
    </div>
  )
}
