import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { DEMO_PATIENT_ID } from '../episodeData'
import { CopilotMessage } from '../components/CopilotMessage'

const MAX_QUESTION_LENGTH = 2000
const suggestedQuestions = [
  'What follow-up information is recorded?',
  'What warning signs were listed?',
  'What did I write during my last appointment?',
  'What care journeys do I have recorded?',
]

function createMessageId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function CopilotPage({ initialQuestion = '' }) {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState(initialQuestion)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const lastResponseRef = useRef(null)
  const questionInputRef = useRef(null)

  useEffect(() => {
    if (initialQuestion) questionInputRef.current?.focus()
  }, [initialQuestion])

  useEffect(() => {
    const latest = messages[messages.length - 1]
    if (latest?.role === 'assistant') lastResponseRef.current?.focus()
  }, [messages])

  useEffect(() => {
    const input = questionInputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`
    input.style.overflowY = input.scrollHeight > 200 ? 'auto' : 'hidden'
  }, [question])

  const askQuestion = async (value, { retry = false } = {}) => {
    const trimmedQuestion = value.trim()
    if (!trimmedQuestion || submitting) return

    setError(null)
    setStatusMessage('CareLoop is looking through your recorded care.')
    if (!retry) {
      setMessages(current => [...current, { id: createMessageId(), role: 'user', text: trimmedQuestion }])
      setQuestion('')
      setSuggestionsOpen(false)
    }
    setSubmitting(true)

    try {
      const response = await api.askCopilot(DEMO_PATIENT_ID, trimmedQuestion)
      setMessages(current => [...current, { id: createMessageId(), role: 'assistant', response }])
      setStatusMessage('CareLoop response ready.')
    } catch (err) {
      setError({
        message: err.message || 'CareLoop could not check your recorded care. Please try again.',
        question: trimmedQuestion,
      })
      setStatusMessage('CareLoop could not retrieve a response.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = event => {
    event.preventDefault()
    askQuestion(question)
  }

  const handleQuestionKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      askQuestion(question)
    }
  }

  return (
    <div className="page-shell copilot-page">
      <section className="copilot-surface" aria-labelledby="copilot-heading">
        <div className="page-intro">
          <p className="page-intro__eyebrow">Your recorded care</p>
          <h1 id="copilot-heading">CareLoop Copilot</h1>
          <p>Ask about information already recorded in your care.</p>
        </div>

        <div className="copilot-status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </div>

        {messages.length === 0 ? (
          <section className="copilot-empty" aria-labelledby="suggestions-heading">
            <div className="copilot-suggestions">
              <h2 id="suggestions-heading">Suggested questions</h2>
              <div className="copilot-suggestions__list">
                {suggestedQuestions.map(prompt => (
                  <button key={prompt} className="copilot-suggestion" type="button" onClick={() => askQuestion(prompt)} disabled={submitting}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="copilot-conversation" aria-label="Copilot conversation">
            {messages.map((message, index) => (
              <CopilotMessage
                key={message.id}
                message={message}
                focusRef={index === messages.length - 1 && message.role === 'assistant' ? lastResponseRef : undefined}
                onSuggestedQuestion={askQuestion}
              />
            ))}
          </section>
        )}

        {submitting && (
          <div className="copilot-loading" role="status" aria-live="polite">
            <span className="copilot-loading__mark" aria-hidden="true">…</span>
            <span>Looking through your recorded care…</span>
          </div>
        )}

        {error && (
          <div className="copilot-error" role="alert">
            <div>
              <strong>We could not reach CareLoop</strong>
              <p>{error.message}</p>
            </div>
            <button className="btn btn--secondary" type="button" onClick={() => askQuestion(error.question, { retry: true })} disabled={submitting}>Try again</button>
          </div>
        )}

        <form className="copilot-form" onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="copilot-question">Ask about your recorded care</label>
          {messages.length > 0 && (
            <div className="copilot-form__tools">
              <button className="btn btn--ghost copilot-suggestions-toggle" type="button" aria-expanded={suggestionsOpen} aria-controls="copilot-inline-suggestions" onClick={() => setSuggestionsOpen(open => !open)} disabled={submitting}>Suggestions</button>
            </div>
          )}
          {messages.length > 0 && suggestionsOpen && (
            <div className="copilot-inline-suggestions" id="copilot-inline-suggestions" aria-label="Suggested questions">
              {suggestedQuestions.map(prompt => (
                <button key={prompt} className="copilot-suggestion" type="button" onClick={() => askQuestion(prompt)} disabled={submitting}>{prompt}</button>
              ))}
            </div>
          )}
          <div className="copilot-form__composer">
        <textarea
          id="copilot-question"
          ref={questionInputRef}
          className="form-control form-control--textarea copilot-form__input"
          value={question}
          onChange={event => setQuestion(event.target.value)}
          onKeyDown={handleQuestionKeyDown}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="For example: What follow-up information is recorded?"
          aria-describedby="copilot-question-hint"
          disabled={submitting}
        />
        <button className="btn btn--primary copilot-form__submit" type="submit" aria-label="Send question" title="Send question" disabled={submitting || !question.trim()}>
          {submitting ? '…' : '↑'}
        </button>
          </div>
          <div className="copilot-form__meta">
            <p id="copilot-question-hint" className="form-hint">Press Enter to send. Press Shift+Enter for a new line.</p>
            {question.length >= 1800 && <p id="copilot-question-count" className="copilot-form__count" aria-live="polite">{question.length}/{MAX_QUESTION_LENGTH}</p>}
          </div>
          <p className="copilot-form__boundary">CareLoop uses your recorded care and does not diagnose or recommend treatment.</p>
        </form>
      </section>

    </div>
  )
}
