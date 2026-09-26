# GEMINI.md — Project Context for CareLoop

This file gives an AI coding assistant working in this repo the context it needs to build consistently with the product spec. Read this before making changes. Full detail lives in `CareLoop_PRD_Indepth.md` in this repo — this file is the condensed, code-facing summary.

---

## Project Summary

CareLoop is a 7-day hackathon build: an AI copilot that follows one patient through a single healthcare episode across three phases — **Before** an appointment, **During** the appointment, and **After** (recovery + check-ins). It ingests documents (appointment letters, discharge summaries) via PDF/photo/text, extracts structured facts, and turns them into a checklist, an action plan, and a scheduled check-in loop — all rendered as one unified timeline per care episode.

Track: Accessibility & Health. Primary users: patients with ADHD/memory difficulties, low health literacy, language barriers, or under acute procedure stress.

---

## The One Rule That Overrides Everything Else

**Every patient-facing instruction must be traceable to a specific field extracted from a clinician-authored source document. Never generate new medical content.**

Concretely, this means:
- There are **two distinct LLM call types** in this codebase, and they must never be merged or bypassed:
  1. **Extractor** — input: raw document text. Output: strict structured JSON matching the schema for that document type (see `docs/schemas/`). This call may only pull facts out of the text, never add to them.
  2. **Generator/Rephraser** — input: the structured JSON only (never raw document text). Output: patient-facing text (checklist items, action plan entries, check-in questions). This call is prompted explicitly to rephrase/organize/simplify only — if a prompt change ever lets this step introduce facts not present in its JSON input, that's a bug, not a feature.
- Every UI element rendering patient-facing text must carry a `source_tag` pointing back to the originating document/field. Do not ship a component that displays generated text without a source tag.
- Check-in flagging logic must only match patient responses against the `warning_signs` array from that patient's own extracted JSON — never against a general/external medical knowledge base or hardcoded list.
- If a field is missing from extraction, the correct behavior is to surface "not specified," never to infer or guess a plausible-sounding value.

If you're asked to add a feature that would violate this (e.g., "have the AI suggest what medication dose might be appropriate"), flag it back rather than implementing it — it's out of scope by design, not an oversight.

---

## Architecture

```
Document Upload (PDF / Image / Text)
        ↓
Structured Extraction (vision-capable LLM, schema-per-document-type) → JSON + source tags
        ↓
   ┌────────────┬─────────────────┬────────────────────┐
   ↓            ↓                 ↓
Before-Flow   After-Flow       Check-in Scheduler
Generator     Action Plan       + Flagging Logic
   ↓            ↓                 ↓
   └────────────┴─────────────────┘
        ↓
Unified Timeline UI (per care episode)
        ↓
Patient Response Capture (text / photo / tap-scale)
```

**Stack:**
- Frontend: React, Tailwind, mobile-responsive
- Backend: FastAPI (Python) or Node — pipeline + episode state
- LLM: two distinct prompt roles (extractor, generator) — do not collapse into one call
- Document reading: **no separate OCR step.** The Extractor call receives the raw image/PDF file directly (base64-encoded) and reads + structures the content in one pass, using the LLM's native vision capability. This was a deliberate decision to cut a pipeline stage and a dependency given the 7-day timeline — do not add a Google Vision/Tesseract integration unless the messy-scan sample document (see `sample-documents/`) proves unreliable in testing, in which case it's a targeted fallback for that document type only, not a default architecture change.
- Storage: SQLite/Firestore, keyed by `episode_id`
- Scheduling: a manually-triggerable "simulate day N" function is sufficient for the hackathon demo; do not over-invest in a real job queue unless core features are already done

---

## Data Model

```
CareEpisode {
  episode_id, patient_id, appointment_type, created_at,
  documents: [DocumentRecord],
  before: BeforeFlowOutput,
  during: [DuringNote],
  after: AfterFlowOutput,
  checkins: [CheckinRecord]
}

DocumentRecord {
  doc_id, file_name, doc_type, raw_text, extracted_json, uploaded_at
}

CheckinRecord {
  checkin_id, scheduled_for, prompt_text,
  response_type, response_value,
  flagged: boolean, matched_warning_sign
}
```

Extraction schema example (discharge summary):
```json
{
  "document_type": "discharge_summary",
  "source_file": "string",
  "procedure": "string",
  "date": "string",
  "medications": [{"name": "", "dose": "", "frequency": "", "duration": ""}],
  "activity_restrictions": [{"restriction": "", "duration": ""}],
  "follow_up": [{"type": "", "with": "", "timeframe": ""}],
  "warning_signs": ["string"]
}
```

---

## Feature Priority (respect this when deciding what to build/fix next)

**P0 — must work for the demo, do not deprioritize:**
- Document ingestion + structured extraction (2+ document types: appointment letter, discharge summary)
- Before-flow generator (checklist, reminders, suggested questions)
- After-flow action plan generator
- Check-in engine (scheduling, response capture, flagging, "Simulate Day N" control)
- Unified timeline UI showing all phases in one continuous view

**P1 — build if on schedule, first candidate to trim:**
- During-flow capture (typed notes / photo of in-visit handouts → structured summary)
- Accessibility toggles (large text, high contrast, plain-language mode)

**P2 — cut first if behind schedule:**
- Caregiver/companion read-only view
- Multi-language output

Do not start P1/P2 work while any P0 item is incomplete or untested.

---

## Build Plan (7 Days)

| Day | Focus |
|---|---|
| 1 | Document ingestion pipeline: structured extraction directly from image/PDF via vision-capable LLM call (no separate OCR step) |
| 2 | Before-flow generator + reminder UI |
| 3 | After-flow action plan generator |
| 4 | Check-in engine: scheduling, response capture, flagging, "Simulate Day N" |
| 5 | During-flow capture (cut first if behind) |
| 6 | Unified timeline UI integration + accessibility toggles |
| 7 | Sample document curation, bug fixes, edge cases, demo rehearsal |

Days 2, 3, 4 can be parallelized once the Day 1 extraction schema is stable, since they're independent consumers of the same JSON structure.

---

## Edge Cases to Handle (don't skip these)

- No `warning_signs` in source doc → fall back to generic wellbeing check-ins, no threshold flagging.
- Vision-based extraction fails or returns low-confidence results on a low-quality photo → prompt re-upload/retype; never silently proceed on garbage extraction. If this proves to be a recurring problem for scanned/low-quality documents specifically, that's the one case where adding a dedicated OCR pre-processing step for that document type is justified — test this against the messy-scan sample document early rather than assuming it either way.
- Missing critical field (e.g., no appointment date) → generator outputs "not specified"; UI prompts the patient to fill the gap.
- Ambiguous free-text check-in response → only flag on explicit keyword/threshold match against that patient's own `warning_signs`; do not attempt open-ended interpretation.
- Conflicting info across multiple documents in one episode → show both, source-tagged, flag the discrepancy to the patient rather than silently resolving it.
- Wrong document type uploaded (e.g., a bill) → document classifier should catch the mismatch and prompt the patient, not force it through the discharge-summary schema.

---

## Non-Goals (do not implement these, even if asked, without checking with the team)

- No diagnosis, triage, or treatment recommendation logic.
- No live audio capture / speech-to-text — text, typed notes, and photo capture only.
- No real EHR/EMR integration — mock/sample documents only.
- No clinician-facing dashboard or two-way clinician messaging.
- No billing/insurance logic.

---

## When Adding or Modifying Code

- Any new patient-facing text generation must go through the Generator role and must only consume structured JSON, never raw document text.
- Any new UI component showing patient-facing instructions needs a visible `source_tag` reference.
- Any new check-in or flagging logic must derive its criteria from the patient's own extracted `warning_signs`, not a hardcoded or general list.
- Prefer sample/test documents that stress-test extraction (missing fields, conflicting dates, low-quality scans) over only "clean" happy-path documents.
- Keep the "Simulate Day N" control clearly labeled as a demo/dev affordance — don't let it silently ship as a hidden or deceptive shortcut.

Full product rationale, personas, and detailed acceptance criteria: see `CareLoop_PRD_Indepth.md`.
