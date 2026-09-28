import { useState } from 'react'
import { ActionItem } from './ActionItem'
import { InfoCard } from './InfoCard'
import { CheckinCard } from './CheckinCard'
import { DocumentUpload } from './DocumentUpload'
import { SourceTag } from './SourceTag'
import { DuringCapture } from './DuringCapture'
import { api } from '../api'

/**
 * Timeline — the spine + all phase sections
 * Spec: DESIGN.md §3
 *
 * Renders Before / During / After / Check-ins as one continuous scrollable view.
 */
export function Timeline({ episode, onEpisodeUpdate }) {
  const [simulatingDay, setSimulatingDay] = useState(null)
  const [simulatedCheckin, setSimulatedCheckin] = useState(null)
  const [simulateDayInput, setSimulateDayInput] = useState('')
  const [recentlyProcessedPhase, setRecentlyProcessedPhase] = useState(null)

  const handleSimulateDay = async () => {
    const day = parseInt(simulateDayInput, 10)
    if (isNaN(day)) return
    setSimulatingDay(day)
    try {
      const result = await api.simulateDay(episode.episode_id, day)
      setSimulatedCheckin(result)
    } catch (err) {
      console.error('Simulate day failed:', err)
    } finally {
      setSimulatingDay(null)
    }
  }

  const handleUploadComplete = (phase) => {
    setRecentlyProcessedPhase(phase)
    // Refresh episode data after upload
    api.getEpisode(episode.episode_id).then(updated => onEpisodeUpdate?.(updated))
  }

  const handleDuringCapture = (result) => {
    // Refresh episode data after during note capture
    api.getEpisode(episode.episode_id).then(updated => onEpisodeUpdate?.(updated))
  }

  const handleCheckinRespond = () => {
    api.getEpisode(episode.episode_id).then(updated => onEpisodeUpdate?.(updated))
  }

  const hasBefore = !!episode.before
  const hasAfter = !!episode.after
  const hasDuring = episode.during?.length > 0
  const hasCheckins = episode.checkins?.length > 0
  const checkinsComplete = hasCheckins && episode.checkins.every(checkin => checkin.response || checkin.simulated)
  const phaseReady = [hasBefore, hasDuring, hasAfter, checkinsComplete]
  const currentPhaseIndex = phaseReady.findIndex(ready => !ready)
  const allPhasesComplete = currentPhaseIndex === -1
  const activePhaseIndex = currentPhaseIndex === -1 ? phaseReady.length - 1 : currentPhaseIndex
  const phaseNames = [
    'Before your appointment',
    'During your appointment',
    'After your appointment',
    'Check-ins',
  ]
  const phaseStatus = (index) => {
    if (allPhasesComplete) return 'completed'
    if (index < activePhaseIndex) return 'completed'
    if (index === activePhaseIndex) return 'current'
    return 'upcoming'
  }
  const phaseStatusLabel = (status) => ({
    completed: 'Completed',
    current: 'Current',
    upcoming: 'Upcoming',
  }[status])
  const activePhaseName = allPhasesComplete ? 'Check-ins are up to date' : phaseNames[activePhaseIndex]

  return (
    <div>
      {/* ── Episode Header ──────────────────────────────────────────── */}
      <div className="episode-header">
        <p className="episode-header__eyebrow">Care episode</p>
        <h1 className="episode-header__title">
          {episode.appointment_type || 'Your care journey'}
        </h1>
        <p className="episode-header__meta">
          Started {new Date(episode.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
        <p className="episode-header__progress">
          <span className="episode-header__progress-marker" aria-hidden="true">→</span>
          You are here: <strong>{activePhaseName}</strong>
        </p>
      </div>

      {/* ── Timeline body ───────────────────────────────────────────── */}
      <div className="timeline-layout">

        {/* ── BEFORE PHASE ──────────────────────────────────────────── */}
        <div className={'timeline-spine timeline-spine--' + phaseStatus(0)}>
          <div className={'timeline-dot timeline-dot--' + phaseStatus(0)} aria-hidden="true" />
        </div>
        <div className={'timeline-content timeline-phase timeline-phase--' + phaseStatus(0)} role="region" aria-labelledby="phase-before-heading">
          <h2 className="phase-label" id="phase-before-heading">
            <span className="phase-label__text">Before your appointment</span>
            <span className={'phase-status phase-status--' + phaseStatus(0)}>{phaseStatusLabel(phaseStatus(0))}</span>
          </h2>

          {!hasBefore ? (
            <div className="phase-empty">
              {recentlyProcessedPhase === 'before' && (
                <div className="phase-success" role="status" aria-live="polite">
                  <span className="phase-success__icon" aria-hidden="true">✓</span>
                  <div>
                    <strong>Care document processed</strong>
                    <p>Your care journey is ready to review.</p>
                  </div>
                </div>
              )}
              <p className="phase-empty__message">Upload your appointment letter to see preparation steps and questions here.</p>
              <DocumentUpload
                episodeId={episode.episode_id}
                label="Upload your appointment letter to get started"
                onUploadComplete={() => handleUploadComplete('before')}
              />
            </div>
          ) : (
            <div>
              {recentlyProcessedPhase === 'before' && (
                <div className="phase-success" role="status" aria-live="polite">
                  <span className="phase-success__icon" aria-hidden="true">✓</span>
                  <div>
                    <strong>Care document processed</strong>
                    <p>Your care journey is ready to review.</p>
                  </div>
                </div>
              )}
              {/* Checklist */}
              {episode.before.checklist?.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <h2 style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-headline)' }}>
                    Preparation checklist
                  </h2>
                  {episode.before.checklist.map((item, i) => (
                    <ActionItem
                      key={i}
                      item={item.item}
                      timing={item.relative_time}
                      category={item.category}
                      done={item.done}
                      sourceField={item.source_field}
                      extractedJson={episode.documents.find(d => d.doc_type === 'appointment_letter')?.extracted_json}
                      sourceLabel="your appointment letter"
                      animDelay={i}
                    />
                  ))}
                </div>
              )}

              {/* Suggested questions */}
              {episode.before.suggested_questions?.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <h2 style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-headline)' }}>
                    Questions to ask your clinician
                  </h2>
                  {episode.before.suggested_questions.map((q, i) => (
                    <div
                      key={i}
                      className={`card card--info card-animate card-animate-delay-${Math.min(i, 7)}`}
                      style={{ marginBottom: 'var(--space-3)' }}
                    >
                      <p style={{ fontWeight: 500, marginBottom: 'var(--space-1)' }}>💬 {q.question}</p>
                      <p style={{ color: 'var(--color-ink-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                        {q.reason}
                      </p>
                      <SourceTag
                        sourceField={q.source_field}
                        extractedJson={episode.documents.find(d => d.doc_type === 'appointment_letter')?.extracted_json}
                        documentLabel="your appointment letter"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Already uploaded — offer to add more docs */}
              <details style={{ marginTop: 'var(--space-4)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--text-sm)' }}>
                  + Upload another before-appointment document
                </summary>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <DocumentUpload
                    episodeId={episode.episode_id}
                    onUploadComplete={() => handleUploadComplete('before')}
                  />
                </div>
              </details>
            </div>
          )}
        </div>

        {/* ── DURING PHASE ──────────────────────────────────────────── */}
        <div className={'timeline-spine timeline-spine--' + phaseStatus(1)}>
          <div className={'timeline-dot timeline-dot--' + phaseStatus(1)} aria-hidden="true" />
        </div>
        <div className={'timeline-content timeline-phase timeline-phase--' + phaseStatus(1)} role="region" aria-labelledby="phase-during-heading">
          <h2 className="phase-label" id="phase-during-heading">
            <span className="phase-label__text">During your appointment</span>
            <span className={'phase-status phase-status--' + phaseStatus(1)}>{phaseStatusLabel(phaseStatus(1))}</span>
          </h2>

          {!hasDuring ? (
            <div className="phase-empty">
              <p className="phase-empty__message">Add notes from your appointment here to keep instructions in one place.</p>
              <DuringCapture
                episodeId={episode.episode_id}
                onCaptureComplete={handleDuringCapture}
              />
            </div>
          ) : (
            <div>
              {episode.during.map((note, i) => (
                <div
                  key={note.note_id}
                  className={`card card-animate card-animate-delay-${Math.min(i, 7)}`}
                  style={{ marginBottom: 'var(--space-4)' }}
                >
                  <h3 style={{ marginBottom: 'var(--space-3)' }}>Visit notes</h3>
                  {note.structured_summary?.visit_summary?.summary && (
                    <p style={{ marginBottom: 'var(--space-4)' }}>
                      {note.structured_summary.visit_summary.summary}
                    </p>
                  )}
                  {note.structured_summary?.visit_summary?.action_items?.map((item, j) => (
                    <ActionItem
                      key={j}
                      item={item.text}
                      timing={item.timing}
                      category="action"
                      done={false}
                      sourceField="patient_note"
                      animDelay={j}
                    />
                  ))}
                  {note.structured_summary?.visit_summary?.general_info?.map((info, j) => (
                    <InfoCard
                      key={j}
                      text={info.text}
                      sourceField="patient_note"
                      animDelay={j}
                    />
                  ))}
                </div>
              ))}
              <details style={{ marginTop: 'var(--space-4)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--color-ink-muted)', fontSize: 'var(--text-sm)' }}>
                  + Add more visit notes
                </summary>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <DuringCapture
                    episodeId={episode.episode_id}
                    onCaptureComplete={handleDuringCapture}
                  />
                </div>
              </details>
            </div>
          )}
        </div>

        {/* ── AFTER PHASE ───────────────────────────────────────────── */}
        <div className={'timeline-spine timeline-spine--' + phaseStatus(2)}>
          <div className={'timeline-dot timeline-dot--' + phaseStatus(2)} aria-hidden="true" />
        </div>
        <div className={'timeline-content timeline-phase timeline-phase--' + phaseStatus(2)} role="region" aria-labelledby="phase-after-heading">
          <h2 className="phase-label" id="phase-after-heading">
            <span className="phase-label__text">After your appointment</span>
            <span className={'phase-status phase-status--' + phaseStatus(2)}>{phaseStatusLabel(phaseStatus(2))}</span>
          </h2>

          {!hasAfter ? (
            <div className="phase-empty">
              {recentlyProcessedPhase === 'after' && (
                <div className="phase-success" role="status" aria-live="polite">
                  <span className="phase-success__icon" aria-hidden="true">✓</span>
                  <div>
                    <strong>Care document processed</strong>
                    <p>Your care journey is ready to review.</p>
                  </div>
                </div>
              )}
              <p className="phase-empty__message">Upload your discharge summary to build your recovery plan and follow-up details.</p>
              <DocumentUpload
                episodeId={episode.episode_id}
                label="Upload your discharge summary to generate a recovery plan"
                onUploadComplete={() => handleUploadComplete('after')}
              />
            </div>
          ) : (
            <div>
              {recentlyProcessedPhase === 'after' && (
                <div className="phase-success" role="status" aria-live="polite">
                  <span className="phase-success__icon" aria-hidden="true">✓</span>
                  <div>
                    <strong>Care document processed</strong>
                    <p>Your care journey is ready to review.</p>
                  </div>
                </div>
              )}
              {/* Medications summary */}
              {episode.after.medications_summary?.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <h2 style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-headline)' }}>
                    Your medications
                  </h2>
                  {episode.after.medications_summary.map((med, i) => (
                    <ActionItem
                      key={i}
                      item={med.plain_instruction}
                      timing={null}
                      done={false}
                      sourceField={med.source_field}
                      extractedJson={episode.documents.find(d => d.doc_type === 'discharge_summary')?.extracted_json}
                      sourceLabel="your discharge summary"
                      animDelay={i}
                    />
                  ))}
                </div>
              )}

              {/* Action plan */}
              {episode.after.action_plan?.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <h2 style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-headline)' }}>
                    Recovery plan
                  </h2>
                  {episode.after.action_plan.map((milestone, mi) => (
                    <div key={mi} style={{ marginBottom: 'var(--space-6)' }}>
                      <h3 style={{
                        marginBottom: 'var(--space-3)',
                        color: 'var(--color-ink-muted)',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {milestone.milestone}
                      </h3>
                      {milestone.instructions.map((instr, ii) => (
                        <ActionItem
                          key={ii}
                          item={instr.text}
                          done={false}
                          sourceField={instr.source_field}
                          extractedJson={episode.documents.find(d => d.doc_type === 'discharge_summary')?.extracted_json}
                          sourceLabel="your discharge summary"
                          animDelay={mi + ii}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-up summary */}
              {episode.after.follow_up_summary?.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <h2 style={{ marginBottom: 'var(--space-4)', fontFamily: 'var(--font-headline)' }}>
                    Follow-up appointments
                  </h2>
                  {episode.after.follow_up_summary.map((f, i) => (
                    <InfoCard
                      key={i}
                      text={`${f.plain_instruction}${f.timeframe ? ` — ${f.timeframe}` : ''}`}
                      sourceField={f.source_field}
                      extractedJson={episode.documents.find(d => d.doc_type === 'discharge_summary')?.extracted_json}
                      documentLabel="your discharge summary"
                      animDelay={i}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CHECK-INS PHASE ───────────────────────────────────────── */}
        <div className={'timeline-spine timeline-spine--' + phaseStatus(3)}>
          <div className={'timeline-dot timeline-dot--' + phaseStatus(3)} aria-hidden="true" />
        </div>
        <div className={'timeline-content timeline-phase timeline-phase--' + phaseStatus(3)} role="region" aria-labelledby="phase-checkins-heading">
          <h2 className="phase-label" id="phase-checkins-heading">
            <span className="phase-label__text">Check-ins</span>
            <span className={'phase-status phase-status--' + phaseStatus(3)}>{phaseStatusLabel(phaseStatus(3))}</span>
          </h2>

          {!hasCheckins ? (
            <p className="phase-empty text-muted">
              Your scheduled check-ins will appear here after you upload your discharge summary.
            </p>
          ) : (
            <div>
              {/* ── Simulate Day N — Demo control ─────────────────────── */}
              <details className="demo-controls">
                <summary>Demo controls</summary>
                <div className="demo-controls__body">
                <div className="demo-badge" style={{ marginBottom: 'var(--space-3)' }}>
                  🎮 Demo control
                </div>
                <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', color: 'var(--color-ink-muted)' }}>
                  These check-ins normally arrive automatically. For this demo, you can trigger one manually:
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="simulate-day" style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Simulate day</label>
                  <input
                    id="simulate-day"
                    type="number"
                    min="1"
                    max="30"
                    value={simulateDayInput}
                    onChange={e => setSimulateDayInput(e.target.value)}
                    style={{
                      width: 60,
                      padding: '6px 10px',
                      border: '1px solid var(--color-line)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'inherit',
                      fontSize: 'var(--text-sm)',
                    }}
                    aria-label="Day number to simulate"
                  />
                  <button
                    className="btn btn--secondary"
                    onClick={handleSimulateDay}
                    disabled={!simulateDayInput || simulatingDay !== null}
                    style={{ fontSize: 'var(--text-sm)', padding: '8px 16px' }}
                  >
                    {simulatingDay !== null ? 'Triggering…' : 'Trigger check-in'}
                  </button>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
                  Available days: {episode.checkins.map(c => `Day ${c.scheduled_for_day}`).join(', ')}
                </p>
                </div>
              </details>

              {/* Rendered check-in cards */}
              {episode.checkins
                .filter(c => c.response || c.simulated)
                .map((checkin, i) => (
                  <CheckinCard
                    key={checkin.checkin_id}
                    checkin={checkin}
                    episodeId={episode.episode_id}
                    documentLabel="your discharge summary"
                    onRespond={handleCheckinRespond}
                    animDelay={i}
                  />
                ))
              }

              {/* Simulated checkin that isn't in the episode yet */}
              {simulatedCheckin?.checkin && !episode.checkins.find(c => c.checkin_id === simulatedCheckin.checkin.checkin_id) && (
                <CheckinCard
                  checkin={simulatedCheckin.checkin}
                  episodeId={episode.episode_id}
                  documentLabel="your discharge summary"
                  onRespond={handleCheckinRespond}
                  animDelay={0}
                />
              )}

              {/* Upcoming check-ins (not yet triggered) */}
              {episode.checkins.filter(c => !c.response && !c.simulated).length > 0 && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <p className="text-muted" style={{ marginBottom: 'var(--space-3)' }}>Upcoming:</p>
                  {episode.checkins.filter(c => !c.response && !c.simulated).map((c, i) => (
                    <div
                      key={c.checkin_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        marginBottom: 'var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-raised)',
                        border: '1px solid var(--color-line)',
                        color: 'var(--color-ink-muted)',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem' }}>○</span>
                      <span>Day {c.scheduled_for_day} — {c.prompt_text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom spine terminator */}
          <div style={{ height: 'var(--space-12)' }} />
        </div>
      </div>
    </div>
  )
}
