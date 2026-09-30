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

  const handleUploadComplete = (result) => {
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
  const checkinSourceJson =
    episode.documents.find(d => d.doc_type === 'discharge_summary')?.extracted_json ||
    episode.documents.at(-1)?.extracted_json ||
    null

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
          {' · '}Episode ID: <code style={{ fontSize: 'var(--text-sm)' }}>{episode.episode_id.slice(0, 8)}</code>
        </p>
      </div>

      {/* ── Timeline body ───────────────────────────────────────────── */}
      <div className="timeline-layout">

        {/* ── BEFORE PHASE ──────────────────────────────────────────── */}
        <div className="timeline-spine">
          <div className={`timeline-dot ${hasBefore ? 'timeline-dot--filled' : ''}`} aria-hidden="true" />
        </div>
        <div className="timeline-content">
          <p className="phase-label">Before the appointment</p>

          {!hasBefore ? (
            <div>
              <DocumentUpload
                episodeId={episode.episode_id}
                label="Upload your appointment letter to get started"
                onUploadComplete={handleUploadComplete}
              />
            </div>
          ) : (
            <div>
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
                    onUploadComplete={handleUploadComplete}
                  />
                </div>
              </details>
            </div>
          )}
        </div>

        {/* ── DURING PHASE ──────────────────────────────────────────── */}
        <div className="timeline-spine">
          <div className={`timeline-dot ${hasDuring ? 'timeline-dot--filled' : ''}`} aria-hidden="true" />
        </div>
        <div className="timeline-content">
          <p className="phase-label">During the appointment</p>

          {!hasDuring ? (
            <div>
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
        <div className="timeline-spine">
          <div className={`timeline-dot ${hasAfter ? 'timeline-dot--filled' : ''}`} aria-hidden="true" />
        </div>
        <div className="timeline-content">
          <p className="phase-label">After the appointment</p>

          {!hasAfter ? (
            <div>
              <DocumentUpload
                episodeId={episode.episode_id}
                label="Upload your discharge summary to generate a recovery plan"
                onUploadComplete={handleUploadComplete}
              />
            </div>
          ) : (
            <div>
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
                      animDelay={i}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CHECK-INS PHASE ───────────────────────────────────────── */}
        <div className="timeline-spine">
          <div className={`timeline-dot ${hasCheckins ? 'timeline-dot--filled' : ''}`} aria-hidden="true" />
        </div>
        <div className="timeline-content">
          <p className="phase-label">Check-ins</p>

          {!hasCheckins ? (
            <p className="text-muted">
              Check-ins will appear here once you upload your discharge summary.
            </p>
          ) : (
            <div>
              {/* ── Simulate Day N — Demo control ─────────────────────── */}
              <div
                style={{
                  marginBottom: 'var(--space-6)',
                  padding: 'var(--space-4)',
                  background: '#FFFBEB',
                  border: '1px solid #F4CA64',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div className="demo-badge" style={{ marginBottom: 'var(--space-3)' }}>
                  🎮 Demo control
                </div>
                <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', color: 'var(--color-ink-muted)' }}>
                  In production, check-ins are sent automatically. For the demo, trigger one manually:
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Simulate Day</span>
                  <input
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

              {/* Rendered check-in cards */}
              {episode.checkins
                .filter(c => c.response || c.simulated)
                .map((checkin, i) => (
                  <CheckinCard
                    key={checkin.checkin_id}
                    checkin={checkin}
                    episodeId={episode.episode_id}
                    onRespond={handleCheckinRespond}
                    animDelay={i}
                    extractedJson={checkinSourceJson}
                  />
                ))
              }

              {/* Simulated checkin that isn't in the episode yet */}
              {simulatedCheckin?.checkin && !episode.checkins.find(c => c.checkin_id === simulatedCheckin.checkin.checkin_id) && (
                <CheckinCard
                  checkin={simulatedCheckin.checkin}
                  episodeId={episode.episode_id}
                  onRespond={handleCheckinRespond}
                  animDelay={0}
                  extractedJson={checkinSourceJson}
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
