import { useState } from 'react'
import { SourceTag } from './SourceTag'
import { DuringCapture } from './DuringCapture'

export function PreparedQuestionCard({
  question,
  answerNotes = [],
  episodeId,
  extractedJson,
  documentName,
  onCaptureComplete,
}) {
  const [isCapturing, setIsCapturing] = useState(false)
  const questionId = question.question_id || `question-${question.question}`
  const hasAnswer = answerNotes.length > 0

  return (
    <article className="prepared-question-card">
      <div className="prepared-question-card__question">
        <span className="prepared-question-card__icon" aria-hidden="true">?</span>
        <p>{question.question}</p>
      </div>
      {question.reason && <p className="prepared-question-card__reason">{question.reason}</p>}
      <SourceTag
        sourceField={question.source_field}
        extractedJson={extractedJson}
        documentLabel="your appointment letter"
        documentName={documentName}
        displayText={question.question}
      />

      <div className="prepared-question-card__notes">
        <h4>{hasAnswer ? 'You recorded' : 'No answer recorded yet'}</h4>
        {answerNotes.map(note => (
          <div className="prepared-question-card__note" key={note.note_id}>
            <p>{note.raw_text}</p>
            <SourceTag sourceField="patient_note" displayText={note.raw_text} />
          </div>
        ))}
      </div>

      {!isCapturing ? (
        <button
          type="button"
          className="btn btn--secondary prepared-question-card__capture"
          onClick={() => setIsCapturing(true)}
        >
          {hasAnswer ? 'Add another note' : 'Add what you heard'}
        </button>
      ) : (
        <div className="prepared-question-card__capture-form">
          <DuringCapture
            episodeId={episodeId}
            questionId={questionId}
            questionText={question.question}
            idPrefix={`question-${questionId}`}
            label="Add what you heard"
            hint="Write in your own words. This will be saved as a patient-entered visit note, not a clinician-confirmed instruction."
            submitLabel="Save what I heard"
            onCaptureComplete={(result) => {
              setIsCapturing(false)
              onCaptureComplete?.(result)
            }}
          />
          <button type="button" className="btn btn--text" onClick={() => setIsCapturing(false)}>
            Cancel
          </button>
        </div>
      )}
    </article>
  )
}
