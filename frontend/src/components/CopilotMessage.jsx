import { CopilotCitation } from './CopilotCitation'

function uniqueCitations(response) {
  return new Map((response.citations || []).map(citation => [citation.evidence_id, citation]))
}

export function CopilotMessage({ message, focusRef, onSuggestedQuestion }) {
  if (message.role === 'user') {
    return (
      <article className="copilot-message copilot-message--user">
        <p className="copilot-message__label">You</p>
        <p>{message.text}</p>
      </article>
    )
  }

  const response = message.response
  const citations = uniqueCitations(response)
  const segments = response.segments?.length > 0
    ? response.segments
    : [{ text: response.answer, citation_ids: [] }]

  return (
    <article
      className={`copilot-message copilot-message--assistant copilot-message--${response.answer_type}`}
      ref={focusRef}
      tabIndex="-1"
      aria-label={`CareLoop response: ${response.answer_type}`}
    >
      <div className="copilot-message__header">
        <p className="copilot-message__label"><span className="copilot-message__marker" aria-hidden="true">C</span>CareLoop Copilot</p>
        {response.answer_type === 'grounded' && <span className="copilot-message__status">From your recorded care</span>}
        {response.answer_type === 'unsupported' && <span className="copilot-message__status">Care boundary</span>}
        {response.answer_type === 'not_found' && <span className="copilot-message__status">Not found in your records</span>}
      </div>
      <div className="copilot-message__content">
        {segments.map((segment, index) => (
          <div className="copilot-message__segment" key={`${message.id}-segment-${index}`}>
            <p>{segment.text}</p>
            {segment.citation_ids?.length > 0 && (
              <div className="copilot-message__citations" aria-label="Sources for this part of the answer">
                {segment.citation_ids.length > 1 && <p className="copilot-citation__summary">{segment.citation_ids.length} sources</p>}
                {segment.citation_ids.map(citationId => {
                  const citation = citations.get(citationId)
                  return citation ? <CopilotCitation key={citationId} citation={citation} /> : null
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {onSuggestedQuestion && response.answer_type === 'unsupported' && (
        <button className="copilot-message__followup" type="button" onClick={() => onSuggestedQuestion('Show my recorded warning signs')}>
          Show my recorded warning signs
        </button>
      )}
      {onSuggestedQuestion && response.answer_type === 'not_found' && (
        <button className="copilot-message__followup" type="button" onClick={() => onSuggestedQuestion('What care journeys do I have recorded?')}>
          What care journeys do I have recorded?
        </button>
      )}
    </article>
  )
}
