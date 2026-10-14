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
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const lastResponseRef = useRef(null)
  const questionInputRef = useRef(null)
  const deleteDialogRef = useRef(null)
  const deleteCancelRef = useRef(null)
  const deleteTriggerRef = useRef(null)

  useEffect(() => {
    if (initialQuestion) questionInputRef.current?.focus()
  }, [initialQuestion])

  const refreshConversations = async () => {
    try {
      setConversations(await api.listCopilotConversations())
    } catch {
      // Chat history is supportive UI; the grounded question flow remains available.
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    refreshConversations()
  }, [])

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

  useEffect(() => {
    if (!pendingDeleteConversation) return undefined
    deleteCancelRef.current?.focus()
    const dialog = deleteDialogRef.current
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setPendingDeleteConversation(null)
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingDeleteConversation])

  useEffect(() => {
    if (pendingDeleteConversation) return
    if (deleteTriggerRef.current?.isConnected) {
      deleteTriggerRef.current.focus()
    } else {
      questionInputRef.current?.focus()
    }
    deleteTriggerRef.current = null
  }, [pendingDeleteConversation])

  const startNewChat = () => {
    setSelectedConversationId(null)
    setMessages([])
    setQuestion('')
    setError(null)
    setStatusMessage('')
    setSuggestionsOpen(false)
    setHistoryOpen(false)
    window.setTimeout(() => questionInputRef.current?.focus(), 0)
  }

  const openConversation = async conversationId => {
    if (submitting || conversationId === selectedConversationId) return
    setHistoryOpen(false)
    setError(null)
    try {
      const conversation = await api.getCopilotConversation(conversationId)
      setSelectedConversationId(conversation.id)
      setMessages(conversation.messages.map(message => ({
        id: message.id,
        role: message.role,
        text: message.text,
        response: message.response,
      })))
      setStatusMessage('Conversation loaded.')
      window.setTimeout(() => questionInputRef.current?.focus(), 0)
    } catch (err) {
      setError({ message: err.message || 'We could not open that conversation.', question: '' })
    }
  }

  const requestDelete = (conversationId, event) => {
    deleteTriggerRef.current = event.currentTarget
    setPendingDeleteConversation(conversationId)
  }

  const deleteConversation = async conversationId => {
    try {
      await api.deleteCopilotConversation(conversationId)
      if (conversationId === selectedConversationId) startNewChat()
      await refreshConversations()
      return true
    } catch (err) {
      setError({ message: err.message || 'We could not delete that conversation.', question: '' })
      return false
    }
  }

  const confirmDeleteConversation = async () => {
    if (!pendingDeleteConversation) return
    if (await deleteConversation(pendingDeleteConversation)) setPendingDeleteConversation(null)
  }

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
      const response = await api.askCopilot(DEMO_PATIENT_ID, trimmedQuestion, undefined, selectedConversationId, !retry)
      if (response.conversation_id) setSelectedConversationId(response.conversation_id)
      setMessages(current => [...current, { id: createMessageId(), role: 'assistant', response }])
      await refreshConversations()
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
      <div className="copilot-workspace">
        <div id="copilot-history" className={`copilot-history ${historyOpen ? 'copilot-history--open' : ''}`}>
          <div className="copilot-history__header">
            <h2>Chats</h2>
            <button className="btn btn--primary copilot-history__new" type="button" onClick={startNewChat} disabled={submitting}>+ New chat</button>
          </div>
          <p className="copilot-history__label">Recent chats</p>
          {historyLoading && <p className="copilot-history__empty">Loading chats…</p>}
          {!historyLoading && conversations.length === 0 && <p className="copilot-history__empty">Start a conversation about your recorded care.</p>}
          <div className="copilot-history__list">
            {conversations.map(conversation => (
              <div className={`copilot-history__item ${conversation.id === selectedConversationId ? 'copilot-history__item--selected' : ''}`} key={conversation.id}>
                <button type="button" onClick={() => openConversation(conversation.id)} disabled={submitting}>
                  <span>{conversation.title}</span>
                  <small>{conversation.message_count} {conversation.message_count === 1 ? 'message' : 'messages'}</small>
                </button>
                <button className="copilot-history__delete" type="button" onClick={event => requestDelete(conversation.id, event)} aria-label={`Delete ${conversation.title}`} disabled={submitting}>×</button>
              </div>
            ))}
          </div>
        </div>
        <section className="copilot-surface" aria-labelledby="copilot-heading">
        <button className="btn btn--ghost copilot-history-toggle" type="button" onClick={() => setHistoryOpen(open => !open)} aria-expanded={historyOpen} aria-controls="copilot-history">{historyOpen ? 'Close chats' : 'Chats'}</button>
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

      {pendingDeleteConversation && (
        <div className="copilot-delete-dialog__backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPendingDeleteConversation(null) }}>
          <div className="copilot-delete-dialog" ref={deleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="copilot-delete-title" aria-describedby="copilot-delete-description">
            <h2 id="copilot-delete-title">Delete conversation?</h2>
            <p id="copilot-delete-description">This will delete this Copilot conversation.<br />Your recorded care will not be deleted.</p>
            <div className="copilot-delete-dialog__actions">
              <button className="btn btn--secondary" type="button" ref={deleteCancelRef} onClick={() => setPendingDeleteConversation(null)}>Cancel</button>
              <button className="btn copilot-delete-dialog__confirm" type="button" onClick={confirmDeleteConversation}>Delete conversation</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
