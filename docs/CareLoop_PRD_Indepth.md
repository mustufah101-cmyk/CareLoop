# CareLoop — Product Requirements Document (In-Depth)

**An AI Copilot Before, During, and After Healthcare**

Version 2.0 | Hackathon Build (7-Day Sprint) | Track: Accessibility & Health

---

## 1. Executive Summary

Patients navigating any healthcare episode — a surgery, a scan, a specialist visit, physiotherapy, dental treatment, or recurring chronic care — are handed information in fragments: an appointment letter here, an email there, a verbal instruction during the visit, a discharge paper on the way out, a prescription slip, a follow-up call. No system connects these fragments into one coherent picture. The patient is left to be their own care coordinator, at exactly the moment they are most stressed, distracted, or overwhelmed.

This burden is not evenly distributed. It falls hardest on patients with ADHD or memory difficulties, cognitive disabilities, low health literacy, language barriers, or anyone under the acute stress of a serious procedure.

**CareLoop is a single continuous AI copilot that follows one patient through one care episode from before the appointment to full recovery.** It ingests whatever documentation the patient already receives, extracts what matters, and re-presents it as a clear, accessible, actionable journey — with proactive check-ins that follow up after the appointment ends, rather than assuming the patient will remember, understand, and follow through unaided.

Every instruction CareLoop shows a patient is **traceable to a real clinician-authored document**. The product does not diagnose, does not recommend treatment, and does not generate medical content that wasn't already given to the patient by a professional. Its job is translation, structure, continuity, and follow-through — not medicine.

---

## 2. Problem Statement & Evidence

### 2.1 The core problem
Healthcare information is fragmented across time, format, and channel:
- **Before:** appointment letters, intake forms, insurance pre-authorization notices, prep instructions (fasting, medication pauses)
- **During:** verbal instructions from clinicians, printed handouts, whiteboard notes, visit summaries
- **After:** discharge papers, prescriptions, follow-up scheduling instructions, warning-sign sheets

Patients are expected to synthesize all of this themselves, under stress, often while in pain, medicated, anxious, or juggling caregiving/work responsibilities. There is no single tool that treats the *entire episode* as one continuous object — every existing tool treats one moment (a portal login, a pharmacy reminder app, a bill) as if it were the whole problem.

### 2.2 Why this hits harder for specific populations
- **ADHD / memory difficulties:** working-memory load during a stressful visit is exactly when instruction-following fails; external structure compensates for this reliably, per how ADHD accommodations generally work (checklist offloading, reminders, chunking).
- **Low health literacy:** medical language (e.g., "NPO after midnight," "titrate," "PRN") is frequently misunderstood, leading to non-adherence not from noncompliance but from genuine confusion.
- **Language barriers:** discharge materials are often only available in the clinic's default language; a structured extraction step is inherently translation-ready in a way that raw scanned PDFs are not.
- **Stress/acute procedures:** patients report retaining a minority of what's said verbally during a stressful visit (a well-documented phenomenon in patient-communication literature) — meaning even literate, cognitively unimpaired patients lose information under stress.

### 2.3 Why this is a *documented*, not assumed, problem
Cite in the pitch: readmission and non-adherence research consistently points to discharge-instruction misunderstanding and lack of follow-through as contributing factors — not lack of desire to comply, but lack of a system that carries instructions forward in a usable form. This gives the pitch a defensible, non-anecdotal foundation.

### 2.4 What existing solutions miss
- Patient portals: passive, store documents but don't structure or explain them, and don't follow up.
- Medication reminder apps: solve one slice (pills) with no connection to the appointment or discharge context.
- Post-op call-back programs (where they exist): manual, expensive, inconsistent, not scalable, not accessible outside business hours or across languages.
- General AI chatbots: not grounded to the patient's actual documents, risk of generating unsafe generic medical content.

**CareLoop's wedge:** be the connective tissue across the whole episode, grounded strictly in the patient's own documents.

---

## 3. Goals, Non-Goals, and Success Definition

### 3.1 Goals
1. Convert any appointment-related document into a personalized, plain-language preparation checklist and reminder schedule.
2. Provide a low-friction way to capture and structure what happens during a visit (typed notes, photos of handouts).
3. Convert discharge/follow-up documentation into a structured, actionable recovery plan.
4. Proactively check in with the patient after the appointment, on a schedule derived from their actual instructions, using low-effort response modes (text, photo, tap-scale).
5. Flag concerning patient responses and prompt the patient toward contacting their provider — without ever diagnosing.
6. Present the entire episode as one continuous, visually legible timeline.
7. Remain provably grounded: every instruction traceable to an extracted source fact.

### 3.2 Non-Goals (explicitly out of scope for the hackathon build)
- No diagnosis, triage, or treatment recommendation generation.
- No live audio capture / speech-to-text (descoped by team decision — text, typed notes, and photo capture only).
- No real EHR/EMR integration — sample/mock documents only.
- No clinician-facing dashboard or two-way clinician messaging (patient-facing only).
- No payment, insurance, or billing logic (that's a different product — see "Reconcile" if ever revisited).
- No real push-notification infrastructure required for the demo (in-app "simulate day N" trigger substitutes for real scheduling in front of judges).

### 3.3 Success definition for this hackathon
CareLoop succeeds if, in a single live demo, a judge watches one care episode go from "a pile of confusing documents" to "a clear, structured, followed-through journey" in under 3-4 minutes, and can be shown — on request — exactly which source document backs any given instruction on screen.

---

## 4. Personas

### 4.1 Primary: Priya, 34, ADHD, scheduled for a same-day surgical procedure
Needs: external memory scaffolding for prep steps, can't reliably track fasting windows or "no driving after" rules without reminders. Gets overwhelmed by dense discharge paperwork and defaults to not reading it at all.

### 4.2 Primary: Mr. Osei, 71, low health literacy, recurring physiotherapy
Needs: plain-language explanation of what each visit accomplished and what to do between sessions; struggles with clinical vocabulary; benefits from simple visual scales over open text.

### 4.3 Secondary: Lin, 45, non-native speaker, specialist visit for a new diagnosis-adjacent scan
Needs: structured, translatable output rather than raw scanned English-language documents; wants clear next-step actions rather than dense prose.

### 4.4 Secondary: A caregiver (adult child) supporting an aging parent
Needs: visibility into the parent's care journey to help track adherence and flag concerning check-in responses, without needing to be present at every appointment.

---

## 5. Product Overview — The Three-Phase Journey

CareLoop organizes every care episode (one appointment/procedure and its lead-up and recovery) as a single timeline object with three phases.

### 5.1 Phase 1 — Before the Appointment

**Trigger:** Patient uploads or forwards an appointment-related document (letter, email text, PDF, photo of a printed letter).

**Processing:**
1. Document classified by type (appointment confirmation, pre-op instructions, intake form, etc.)
2. Structured extraction pulls: appointment type, date/time, location, preparation requirements (fasting, medication holds, items to bring), and any explicitly stated accessibility information (parking, interpreter availability, wheelchair access).
3. Checklist generator turns extracted facts into a step-by-step, plain-language checklist, each item timestamped relative to the appointment (e.g., "Stop eating solid food: tonight at midnight").
4. Reminder scheduler creates a reminder sequence (default: 1 week before, 1 day before, morning-of; user-adjustable).
5. Question generator suggests 3-5 questions to ask the clinician, derived from the appointment type and any ambiguous/incomplete extracted fields (e.g., if "follow-up timing" is missing from the source doc, suggest asking about it).

**Output surfaces:**
- Checklist view (checkable items, plain language, icon-supported)
- Reminder list with editable timing
- "Questions to ask" card, exportable/printable or shown on-screen at the appointment

### 5.2 Phase 2 — During the Appointment

**Trigger:** Patient or companion opens the "During" tab while at the appointment (or shortly after).

**Input modes:**
- Typed free-text notes ("doctor said take new pills twice a day with food, no driving for a week")
- Photo capture of any handout, whiteboard, or printed instruction sheet given during the visit

**Processing:**
1. Typed notes and photo-extracted text are merged into one structured note object.
2. AI restructures into a plain-language summary, separating "information" from "action items" (e.g., "Action: take Medication X twice daily with food" vs. "Info: this is a routine follow-up, no cause for concern").

**Output surface:** A simple visit summary card, added to the timeline, viewable by the patient later without needing to recall the conversation from memory.

### 5.3 Phase 3 — After the Appointment

**Trigger:** Patient uploads a discharge summary, after-visit summary, or follow-up letter (PDF/photo/text).

**Processing:**
1. Structured extraction pulls: medications (name, dose, frequency — verbatim from source), activity restrictions, follow-up appointment requirements, explicit warning signs listed in the document.
2. Action plan generator turns this into a day-by-day (or milestone-by-milestone) recovery plan.
3. Check-in scheduler derives a check-in cadence from the instructions (e.g., a document mentioning "monitor incision for 7 days" generates daily check-ins for 7 days; a generic "follow up in 2 weeks" generates a single check-in near that date).

**Check-in interaction:**
- Each check-in presents a short, low-effort prompt tied to something in the source document (e.g., "How is your incision site today?" with a tap-scale from "Looks fine" to "Concerned").
- Patient can respond via tap-scale, short text, or photo (e.g., photo of a healing incision, stored only for the patient's own reference/comparison — not analyzed medically in this build).
- Responses are logged to the timeline.

**Flagging logic:**
- If a response crosses a pre-defined concern threshold (e.g., pain scale ≥ 4/5, or a text response containing flag terms like "fever," "worse," "bleeding" — matched only against terms *explicitly listed as warning signs in the source document*, not invented by the AI), CareLoop surfaces a clear, non-diagnostic prompt: *"This matches a warning sign mentioned in your discharge instructions. Consider contacting your care provider."*
- This flagging never issues a diagnosis or tells the patient what it "means" medically — it only re-surfaces the patient's own document's stated warning criteria.

### 5.4 The Unified Timeline (cross-phase)

All three phases render as one scrollable/tabbed timeline per care episode:
```
[ Before ] ---- [ During ] ---- [ After: Action Plan ] ---- [ Check-ins: Day 1, 3, 7, 14 ]
```
Each item on the timeline is tagged with its source document, so the entire episode is auditable at a glance — this is both a UX feature and a trust/safety feature.

---

## 6. The Grounding Guardrail (Critical Constraint)

This is the product's core safety commitment and must be implemented as an enforced technical pattern, not a disclaimer.

### 6.1 Rule
Every instruction, checklist item, action-plan entry, or check-in question shown to a patient must be traceable to a specific field extracted from a clinician-authored source document. The AI is permitted to **rephrase, simplify, translate register, and schedule** extracted facts. The AI is **never** permitted to introduce new medical content — dosages, treatment suggestions, diagnoses, or warning criteria — that was not present in a source document.

### 6.2 Implementation pattern
1. **Extraction step** (LLM call #1): input = raw document text (from OCR or direct text). Output = strict structured JSON, e.g.:
```json
{
  "document_type": "discharge_summary",
  "source_file": "discharge_summary_09262026.pdf",
  "medications": [
    {"name": "Amoxicillin", "dose": "500mg", "frequency": "3x daily", "duration": "7 days"}
  ],
  "activity_restrictions": [
    {"restriction": "no driving", "duration": "7 days"}
  ],
  "follow_up": [
    {"type": "appointment", "with": "surgeon", "timeframe": "2 weeks"}
  ],
  "warning_signs": [
    "fever above 101F", "redness spreading from incision", "excessive bleeding"
  ]
}
```
2. **Generation steps** (checklist generator, action-plan generator, check-in question generator) receive *only* this structured JSON as input — never the raw document — and are prompted explicitly: *"Rephrase and organize the fields below into [output type]. Do not add any medical information not present in the input. If a field is missing, state that it was not specified rather than inferring a value."*
3. **Source tagging:** every rendered UI element carries a small tag/tooltip: "From: discharge_summary_09262026.pdf" — clickable to reveal the original extracted field.
4. **Flagging logic** matches patient check-in responses only against the `warning_signs` array pulled from that patient's own document — never against a general external medical knowledge base.

### 6.3 Why this matters for judging
This is the single most likely point of scrutiny from judges in a Health track. Being able to open the structured JSON object live and show "this is literally all the AI is allowed to see when generating patient-facing text" is a strong, concrete answer to "how do you prevent hallucinated medical advice."

---

## 7. Detailed Feature Specifications

### 7.1 Document Ingestion & Extraction (P0)
- **Inputs supported:** PDF upload, image upload (JPEG/PNG), pasted/typed text.
- **Pipeline:** file type detection → OCR (for images/scanned PDFs) → text normalization → LLM structured extraction (per schema in 6.2, with a schema variant per document type: appointment letter, discharge summary, prescription, generic handout).
- **Acceptance criteria:**
  - Successfully extracts at least: appointment/procedure name, date, key prep instructions from a sample appointment letter.
  - Successfully extracts at least: 1+ medication, 1+ activity restriction, 1+ follow-up requirement, and warning signs (if present) from a sample discharge summary.
  - Gracefully handles a document with missing fields (returns "not specified" rather than fabricating).
  - Handles at least 2 visually distinct document formats/layouts without code changes (proves generalization, not hardcoding).

### 7.2 Before-Flow Generator (P0)
- **Input:** structured JSON from 7.1 (appointment-letter schema).
- **Output:** checklist (array of `{item, relative_time, done: boolean}`), reminder schedule (array of `{message, trigger_time}`), question list (array of strings).
- **Acceptance criteria:** checklist items are actionable and time-anchored; reminders are user-editable in the UI; questions are contextually relevant to the specific appointment type, not generic boilerplate.

### 7.3 During-Flow Capture (P1)
- **Input:** typed text and/or photo upload during/after the visit.
- **Output:** structured note object `{summary, action_items: [], general_info: []}`.
- **Acceptance criteria:** correctly separates at least one action item from general information in a sample note; photo-derived text is OCR'd and merged into the same structure as typed notes.

### 7.4 After-Flow Action Plan Generator (P0)
- **Input:** structured JSON from 7.1 (discharge-summary schema).
- **Output:** day-by-day or milestone-based recovery plan (array of `{day_or_milestone, instructions: [], source_tags: []}`).
- **Acceptance criteria:** every instruction in the output plan has a traceable `source_tag`; no instruction appears that isn't present in the input JSON.

### 7.5 Check-in Engine (P0)
- **Scheduling logic:** derives check-in cadence from `warning_signs` monitoring duration and `follow_up` timeframes in the extracted JSON. Falls back to a sensible default cadence (Day 1, 3, 7) if the document doesn't specify a duration.
- **Response capture:** tap-scale (configurable range, default 1-5), short text, photo.
- **Flagging:** compares response against the `warning_signs` array; on match/threshold breach, surfaces a "consider contacting your provider" prompt — never a diagnostic statement.
- **Demo affordance:** a "Simulate Day N" control in the UI (visible only in demo/dev mode) that fires the check-in prompt on demand, so the engine's real logic can be shown live without waiting real days.
- **Acceptance criteria:** at least one check-in flow, end-to-end, from scheduled prompt → patient response → flag evaluation → (if applicable) provider-contact prompt, fully demoable on command.

### 7.6 Unified Timeline UI (P0)
- **Structure:** one timeline per care episode; phases as tabs or scrollable sections; each entry source-tagged.
- **Accessibility requirements:** large-text toggle, high-contrast toggle, plain-language mode (shorter sentence generation option in the LLM prompt), and support for simple tap-based interaction (minimizing required typing for low-literacy/motor-difficulty users).
- **Acceptance criteria:** a judge can view one episode's full before → during → after → check-in history in a single continuous view without navigating away.

### 7.7 Accessibility Mode (P1)
- Large text / high-contrast toggle at the account or per-session level.
- "Plain language" toggle that re-runs generation with a simpler-vocabulary prompt constraint.
- Tap-scale as default response mode wherever text would otherwise be required.

### 7.8 Caregiver View (P2 — cut first if behind schedule)
- Read-only or co-managed view of a patient's timeline, gated by patient-granted permission (mocked for demo, not a real auth system).

### 7.9 Multi-language Output (P2 — cut first if behind schedule)
- Structured JSON (Section 6.2) is translation-friendly since it's field-based, not prose — a second-pass translation call could localize checklist/action-plan text. Stretch goal only.

---

## 8. User Flows (Detailed)

### 8.1 Flow A — Before an Appointment
1. Patient opens CareLoop, taps "New care episode."
2. Uploads appointment letter (PDF or photo).
3. System extracts and displays: appointment summary card, checklist, reminders, suggested questions.
4. Patient can edit/dismiss checklist items and adjust reminder timing.
5. Patient receives reminders per schedule (simulated in demo via manual trigger).

### 8.2 Flow B — During the Appointment
1. Patient opens the same episode's "During" tab.
2. Types a quick note and/or snaps a photo of a handout.
3. System returns a structured, plain-language summary card added to the timeline.

### 8.3 Flow C — After the Appointment
1. Patient uploads discharge summary.
2. System extracts and displays the recovery action plan.
3. Check-in schedule is generated and shown to the patient (e.g., "We'll check in with you on Day 1, 3, 7").
4. Patient (or demo operator) triggers "Simulate Day 3."
5. Check-in prompt appears; patient responds via tap-scale and/or text.
6. If response crosses a flagged threshold, a "contact your provider" prompt appears, explicitly citing which warning sign it matched.
7. Timeline updates to show the completed check-in and response.

### 8.4 Flow D — Full Episode Review (Demo Closer)
1. Judge (or patient) views the complete unified timeline for the episode: before checklist (completed), during summary, after action plan, check-in history with flagged/unflagged responses.
2. Any item can be tapped to reveal its source document tag.

---

## 9. Technical Architecture

```
┌─────────────────────────────┐
│  Document Upload             │
│  (PDF / Image / Text)        │
└──────────────┬───────────────┘
               │
               ▼
┌─────────────────────────────┐
│  OCR / Text Normalization     │
└──────────────┬───────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Structured Extraction        │
│  (LLM call, schema-per-type)  │
│  → JSON facts + source tags   │
└──────────────┬───────────────┘
               │
   ┌───────────┼───────────────────────────┐
   ▼           ▼                           ▼
┌────────┐ ┌────────────┐          ┌───────────────────┐
│ Before │ │ After: Plan │          │ Check-in Scheduler │
│ Gen.   │ │ Generator   │          │ + Flagging Logic    │
└───┬────┘ └─────┬──────┘          └─────────┬──────────┘
    │            │                            │
    └────────────┴──────────────┬─────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │  Unified Timeline UI      │
                    │  (per care episode)       │
                    └──────────────┬────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │ Patient Response Capture │
                    │ (text / photo / tap-scale)│
                    └─────────────────────────┘
```

### 9.1 Suggested stack
- **Frontend:** React (web app), Tailwind for rapid styling, mobile-responsive from the start.
- **Backend:** Node.js or Python (FastAPI) for the extraction/generation pipeline and episode state management.
- **LLM:** Claude (or equivalent) for both extraction and generation calls — two distinct prompt roles (extractor vs. rephraser) as described in Section 6.2. Consider using structured/JSON-mode output for the extraction call to reduce parsing errors.
- **OCR:** Off-the-shelf OCR library/API for scanned images and photos of documents.
- **Storage:** SQLite or Firebase/Firestore for per-patient, per-episode state (documents, extracted JSON, timeline entries, check-in responses).
- **Scheduling:** For the hackathon, a manually-triggerable "simulate day N" function is sufficient; a real cron/job queue is a stretch goal only if time allows, not required for the demo to be credible.

### 9.2 Data model (simplified)

**CareEpisode**
```
{
  episode_id, patient_id, appointment_type, created_at,
  documents: [DocumentRecord],
  before: BeforeFlowOutput,
  during: [DuringNote],
  after: AfterFlowOutput,
  checkins: [CheckinRecord]
}
```

**DocumentRecord**
```
{ doc_id, file_name, doc_type, raw_text, extracted_json, uploaded_at }
```

**CheckinRecord**
```
{ checkin_id, scheduled_for, prompt_text, response_type, response_value, flagged: boolean, matched_warning_sign }
```

---

## 10. 7-Day Build Plan (Detailed, with Owners Placeholder)

| Day | Focus | Deliverable | Owner |
|---|---|---|---|
| 1 | Document ingestion pipeline: OCR + text normalization + structured extraction (appointment-letter schema first, then discharge-summary schema) | Working extraction for 2 document types, tested against sample docs | TBD |
| 2 | Before-flow generator + reminder UI | End-to-end demo: upload letter → checklist + reminders + questions rendered | TBD |
| 3 | After-flow action plan generator | End-to-end demo: upload discharge summary → structured recovery plan rendered, source-tagged | TBD |
| 4 | Check-in engine: scheduling logic, response capture (tap-scale/text/photo), flagging logic, "Simulate Day N" control | Full check-in loop demoable on command | TBD |
| 5 | During-flow capture (cut first if behind schedule) | Typed/photo note capture → structured visit summary | TBD |
| 6 | Unified timeline UI integration across all phases + accessibility toggles (large text, high contrast, plain language) | One continuous timeline view, fully navigable | TBD |
| 7 | Sample document curation, bug fixes, edge-case testing, demo rehearsal, pitch deck finalization | Polished, rehearsed demo + backup sample data | TBD |

**Parallelization note:** Days 2, 3, and 4 can be worked on somewhat in parallel by different team members once Day 1's extraction schema is stable, since Before/After/Check-in are largely independent consumers of the same structured JSON output.

---

## 11. Edge Cases & Handling

| Edge Case | Handling |
|---|---|
| Document has no explicit warning signs listed | Check-in flagging logic falls back to no threshold-based flagging for that episode; general wellbeing check-ins only |
| OCR fails to read a low-quality photo | Prompt patient to retake photo or manually type key details; do not silently proceed with garbage extraction |
| Extracted JSON has missing critical fields (e.g., no appointment date) | Generation steps explicitly state "not specified" rather than guessing; UI prompts patient to fill the gap manually if needed |
| Patient check-in response is ambiguous free text | Flag only on explicit keyword/threshold match against the source document's own warning signs; do not attempt open-ended sentiment/medical interpretation |
| Multiple documents for the same episode conflict (e.g., two different follow-up dates) | Show both, source-tagged, and flag the discrepancy to the patient rather than silently picking one |
| Patient uploads an irrelevant document (e.g., a bill by mistake) | Document classification step detects mismatch and prompts "this looks like a billing document — did you mean to upload appointment/discharge info instead?" |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI generates ungrounded medical content | High — safety/trust | Enforced extraction-then-rephrase architecture (Section 6); live demo of structured JSON on request |
| Document parsing fails live in front of judges | High — demo credibility | Pre-test extraction against 3-4 curated sample documents repeatedly before Day 7; have a fallback "known good" document ready |
| Check-in loop looks artificial/faked | Medium — perceived gimmick | "Simulate Day N" framed explicitly as a demo convenience for a real scheduling engine, not hidden or disguised |
| Scope creep across 3 phases + accessibility + caregiver view | High — nothing finishes | Strict P0/P1/P2 prioritization (Section 7); cut During-flow and Caregiver/multi-language first if behind |
| Team unfamiliar with OCR/extraction tooling | Medium — Day 1 delay risk | Identify and test the OCR/extraction approach on Day 0 (before the sprint officially starts) if possible |
| Judges question clinical safety/liability | High — Health track scrutiny | Prepare a specific, rehearsed answer + live demonstration of the grounding guardrail (Section 6.3) |

---

## 13. Success Metrics & Judging Alignment

| Judging Category | How CareLoop Scores | Evidence to Show Live |
|---|---|---|
| Social Impact | Universal problem (every patient), amplified for disabled/cognitively-impaired patients; grounded in documented non-adherence/readmission research | Persona-driven demo narrative (Priya, Mr. Osei) |
| Technical Execution | Multimodal ingestion (PDF/photo/text), structured extraction, generation, scheduling, flagging logic, all working end-to-end | Live document upload → full pipeline execution, not slides |
| Innovation | Continuous-episode framing vs. single-point-solution competitors (portals, reminder apps, chatbots) | Explicit comparison slide + unified timeline demo |
| Design/UX | Confusing → clear transformation visible in one continuous view | Full Flow D (Section 8.4) walkthrough |

---

## 14. Open Questions for the Team (Resolve Before Day 1)

1. Final team headcount and skillset split — determines whether During-flow (P1) and Caregiver/multi-language (P2) stay in scope.
2. Which OCR/extraction tooling and LLM provider will be used — test this on Day 0 if at all possible, since it's the pipeline everything else depends on.
3. What 3-4 sample documents (appointment letter, discharge summary, at minimum) will be used for testing and the live demo — these should be sourced or carefully constructed before Day 3, not left until Day 6.
4. Who owns the pitch narrative and demo script vs. who owns the build — these should be assigned separately so build time isn't cannibalized by last-minute pitch prep.
5. Confirm whether the hackathon rubric rewards "simulate day N" as an acceptable demo convention, or whether judges expect a note explaining it — prepare the explanation regardless.

---

## 15. Appendix: Sample Extracted JSON (Reference for Demo)

```json
{
  "document_type": "discharge_summary",
  "source_file": "discharge_summary_sample.pdf",
  "procedure": "Arthroscopic knee surgery",
  "date": "2026-09-24",
  "medications": [
    {"name": "Ibuprofen", "dose": "400mg", "frequency": "every 6 hours as needed", "duration": "5 days"}
  ],
  "activity_restrictions": [
    {"restriction": "no driving", "duration": "7 days"},
    {"restriction": "no weight-bearing on affected leg", "duration": "3 days"}
  ],
  "follow_up": [
    {"type": "appointment", "with": "orthopedic surgeon", "timeframe": "2 weeks"}
  ],
  "warning_signs": [
    "fever above 101F",
    "increasing redness or swelling at incision site",
    "numbness in the foot"
  ]
}
```

This is the object every downstream generator is restricted to — nothing patient-facing is allowed to exceed what's contained here.
