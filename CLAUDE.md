# CLAUDE.md — CareLoop Project Context

**Last updated:** 2026-09-27

This file provides an AI coding assistant with everything needed to understand, maintain, and extend the CareLoop hackathon project. Read this before making any changes.

---

## Project Overview

**CareLoop** is a 7-day hackathon build (Track: Accessibility & Health) — an AI copilot that follows one patient through a healthcare episode across three phases:
- **Before** an appointment (preparation checklist, reminders, suggested questions)
- **During** the appointment (visit note capture and structuring)
- **After** the appointment (recovery action plan, medication tracking, scheduled check-ins with flagging)

### Key Innovation
Every patient-facing instruction is traceable to a specific field in a clinician-authored source document. CareLoop never invents medical content — it extracts, structures, and rephrases only.

### Primary Users
- Patients with ADHD/memory difficulties
- Those with low health literacy or language barriers
- Patients under acute procedure stress
- Anyone managing complex post-discharge care instructions

---

## The One Inviolable Rule

**Every patient-facing instruction must be traceable to a specific field extracted from a clinician-authored source document.**

This means:
1. **Two distinct LLM roles** (never merge them):
   - **Extractor**: raw document → strict JSON schema (pulls facts only, never adds)
   - **Generator**: structured JSON only → patient-facing text (rephrases only, never invents)
2. Every UI element showing patient-facing text must carry a `source_field` tag
3. Check-in flagging logic only matches against `warning_signs` from the patient's own extracted document
4. Missing fields show "not specified" — never infer or guess

If asked to add a feature that would violate this (e.g., "suggest appropriate medication doses"), flag it as out of scope.

---

## Architecture

```
Document Upload (PDF/Image/Text)
        ↓
Vision-capable LLM Extraction (schema-enforced) → JSON + source tags
        ↓
   ┌────────────┬─────────────────┬────────────────────┐
   ↓            ↓                 ↓                      ↓
Before-Flow   After-Flow    Check-in Schedule    During-Flow
Generator     Generator     Generator            Generator
   ↓            ↓                 ↓                      ↓
   └────────────┴─────────────────┴──────────────────────┘
        ↓
Unified Timeline UI (one continuous scrollable view)
        ↓
Patient Response Capture → Flagging Logic (patient's own warning_signs only)
```

### Tech Stack
- **Frontend**: React 19, Tailwind CSS 4, Vite 8
- **Backend**: FastAPI (Python), async/await throughout
- **LLM**: Google Gemini (gemini-flash-latest with fallbacks)
- **Document Reading**: Vision-capable LLM reads images/PDFs directly (no separate OCR)
- **Storage**: SQLite with JSON blobs per episode (fast iteration, easy to inspect)
- **Scheduling**: "Simulate Day N" manual trigger for hackathon demo (not a real job queue)

### No External Dependencies For
- OCR (the LLM vision capability handles it)
- EHR/EMR integration (sample documents only)
- Real scheduling/job queue (demo control is sufficient)

---

## Project Structure

```
Care - Loop/
├── backend/
│   ├── main.py                     # FastAPI app entry + CORS + lifespan
│   ├── database.py                 # SQLite JSON-blob storage
│   ├── models.py                   # Pydantic models (matches GEMINI.md spec exactly)
│   ├── requirements.txt            # Python dependencies
│   ├── careloop.db                 # SQLite database (created on first run)
│   ├── venv/                       # Python virtual environment
│   ├── extraction/
│   │   ├── extractor_prompts.py    # All LLM prompt templates (Extractor + Generator)
│   │   ├── extractor.py            # Document classifier + structured extraction
│   │   └── generator.py            # Before/After/Check-in/During generators
│   └── routers/
│       ├── episodes.py             # Episode CRUD (create, get, list, delete)
│       ├── documents.py            # File upload + pipeline trigger
│       ├── checkins.py             # Check-in responses + "Simulate Day N"
│       └── during.py               # During-flow note capture
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Root component + accessibility toggles
│   │   ├── main.jsx                # React entry point
│   │   ├── index.css               # Full design system (tokens, components, timeline)
│   │   ├── api.js                  # API client functions
│   │   ├── components/
│   │   │   ├── Timeline.jsx        # Spine + all phase sections
│   │   │   ├── ActionItem.jsx      # Checkable instruction + source tag
│   │   │   ├── InfoCard.jsx        # Non-actionable info + source tag
│   │   │   ├── CheckinCard.jsx     # Tap-scale response + flagging display
│   │   │   ├── DocumentUpload.jsx  # Upload widget + processing animation
│   │   │   └── SourceTag.jsx       # Source tag + popover (required everywhere)
│   │   └── pages/
│   │       └── EpisodePage.jsx     # Main episode page (loads/creates episode)
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── CareLoop_PRD_Indepth.md     # Full product requirements document
│   └── schemas/
│       ├── appointment_letter.json  # Extraction schema for appointment letters
│       ├── discharge_summary.json   # Extraction schema for discharge summaries
│       └── generic_handout.json     # Fallback schema for other clinical docs
├── sample-documents/
│   ├── appointment_letter_sample.txt
│   ├── discharge_summary_sample.txt
│   └── README.md
├── DESIGN.md                        # Frontend design system reference
├── GEMINI.md                        # AI agent rules + architecture constraints
├── README.md                        # Quick start guide
├── .env.example                     # Environment variable template
└── .env                             # Your actual env vars (gitignored)
```

---

## Data Model

See `models.py` for the complete Pydantic definitions. Key models:

### CareEpisode
- `episode_id`, `patient_id`, `appointment_type`, `created_at`
- `documents: List[DocumentRecord]` — all uploaded documents
- `before: BeforeFlowOutput` — checklist, reminders, suggested questions
- `during: List[DuringNote]` — visit notes and structured summaries
- `after: AfterFlowOutput` — action plan, medications, follow-ups
- `checkins: List[CheckinRecord]` — scheduled check-ins with responses

### DocumentRecord
- `doc_id`, `file_name`, `doc_type`, `uploaded_at`
- `raw_text` (stored for reference, never used as generator input)
- `extracted_json` (the structured extraction — this is what generators consume)

### CheckinRecord
- `scheduled_for_day`, `prompt_text`, `response_type` (scale_1_5 | yes_no | text)
- `flagging_criteria` (derived from patient's own warning_signs)
- `response`, `flagged`, `matched_warning_sign`
- `simulated` (True if triggered by "Simulate Day N" demo control)

Every checklist item, action plan instruction, and check-in has a `source_field` pointing back to the extraction.

---

## API Endpoints

### Episodes
- `POST /api/episodes` — create new episode
- `GET /api/episodes?patient_id={id}` — list episodes for patient
- `GET /api/episodes/{episode_id}` — get full episode
- `DELETE /api/episodes/{episode_id}` — delete episode

### Documents
- `POST /api/episodes/{id}/documents` — upload document (triggers full pipeline)
- `GET /api/episodes/{id}/documents/{doc_id}` — get document's extracted JSON

### Check-ins
- `GET /api/episodes/{id}/checkins` — list all check-ins
- `POST /api/episodes/{id}/checkins/{cid}/respond` — submit response
- `POST /api/episodes/{id}/checkins/simulate` — "Simulate Day N" demo control

### During
- `POST /api/episodes/{id}/during` — capture visit notes
- `GET /api/episodes/{id}/during` — list visit notes

### Health
- `GET /health` — health check

---

## Environment Variables

Required in `backend/.env`:

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key | (none) |
| `DATABASE_URL` | No | SQLite path | `sqlite:///./careloop.db` |
| `PORT` | No | Backend port | `8000` |

Frontend automatically uses `http://localhost:8000` for API calls (see `frontend/src/api.js`).

---

## Running the Application

### Backend
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
# → API at http://localhost:8000
# → Swagger docs at http://localhost:8000/docs
```

### Frontend
```powershell
cd frontend
npm run dev
# → App at http://localhost:5173
```

### Testing the Pipeline
1. Upload `sample-documents/appointment_letter_sample.txt` → Before-flow populates
2. Upload `sample-documents/discharge_summary_sample.txt` → After-flow + check-ins populate
3. Use "Simulate Day N" to trigger a check-in
4. Respond with scale value 4 or 5 → flag appears if it matches a warning sign

---

## Feature Priority

### P0 — Must work for demo
- Document ingestion + extraction (appointment letter, discharge summary)
- Before-flow generation (checklist, reminders, questions)
- After-flow generation (action plan, medications, follow-ups)
- Check-in engine (schedule, response, flagging, "Simulate Day N")
- Unified timeline UI

### P1 — Build if on schedule
- During-flow capture (typed notes → structured summary)
- Accessibility toggles (large text, high contrast)

### P2 — Cut first if behind
- Caregiver read-only view
- Multi-language output

**Never start P1/P2 work while any P0 item is incomplete or untested.**

---

## Design System (DESIGN.md Summary)

### Core Principle
**The timeline is the product.** One continuous vertical spine connects every phase. The interface itself communicates: *nothing about your care gets lost or disconnected.*

### Key Design Tokens
- **Colors**: Warm paper background (`#FAF7F1`), action (`#1F6F5C`), info (`#5B6B77`), flag (`#A64B3F`)
- **Typography**: Fraunces (headlines), Public Sans (body), base size 17px (larger than typical)
- **Spacing**: 4px base scale
- **Accessibility modes**: Large text (`a11y-large-text` class), high contrast (`a11y-high-contrast` class)

### Component Types
1. **ActionItem** — checkable instruction with source tag (action-bg, left border accent)
2. **InfoCard** — non-actionable info with source tag (info-bg)
3. **CheckinCard** — tap-scale response (1-5 buttons, minimum 44x44px)
4. **CheckinCard (flagged)** — the most important state, flag-bg with warning message
5. **SourceTag** — always present, always tappable, shows extracted field on expand

### Motion
- **One hero moment**: timeline populating as extraction completes (stagger animation)
- **Micro-interactions only**: checkbox toggle, scale selection, source tag expand
- Respect `prefers-reduced-motion`

---

## Edge Cases to Handle

1. **No warning_signs in source doc** → generic wellbeing check-ins, no threshold flagging
2. **Low-quality scan** → extraction returns `extraction_confidence: "low"` → prompt re-upload
3. **Missing critical field** (e.g., no appointment date) → show "not specified", prompt patient to fill
4. **Ambiguous free-text check-in response** → only flag on explicit keyword/threshold match against patient's own warning_signs
5. **Conflicting info across multiple documents** → show both source-tagged, flag discrepancy
6. **Wrong document type** (e.g., a bill) → classifier catches it → prompt patient with helpful error

---

## Non-Goals (Do Not Implement)

- No diagnosis, triage, or treatment recommendation logic
- No live audio capture / speech-to-text
- No real EHR/EMR integration
- No clinician-facing dashboard or two-way messaging
- No billing/insurance logic
- No general medical knowledge base or symptom checker

---

## When Adding or Modifying Code

### For Backend Changes
1. Any new patient-facing text generation must go through the Generator role
2. Generators must only consume structured JSON, never raw document text
3. Any new check-in/flagging logic must derive criteria from the patient's own extracted `warning_signs`
4. Test against sample documents that stress-test extraction (missing fields, low quality)
5. Keep "Simulate Day N" clearly labeled as a demo control

### For Frontend Changes
1. Any new UI component showing patient-facing instructions needs a visible `SourceTag`
2. Maintain the timeline spine continuity — never break the visual line
3. Respect accessibility toggles (large text, high contrast)
4. All tap targets ≥ 44x44px
5. Color is never the only signal — use icons/borders/labels too

### For LLM Prompt Changes
1. Never merge Extractor and Generator prompts
2. Extractor prompts must explicitly forbid inference/invention
3. Generator prompts must explicitly state they only rephrase, never add facts
4. Every generation must include `source_field` in output schema
5. Test prompt changes against edge cases (missing fields, ambiguous text)

---

## Common Commands

```powershell
# Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
python -m pytest  # (if tests are added)

# Frontend
cd frontend
npm run dev
npm run build
npm run preview

# Database reset (if needed during dev)
cd backend
rm careloop.db
# Database recreates automatically on next startup
```

---

## Known Limitations (Hackathon Scope)

1. **No real scheduling** — "Simulate Day N" is a manual demo trigger, not a production scheduler
2. **Single patient mode** — frontend uses a fixed `demo-patient-001` ID
3. **No authentication** — this is a demo, not a production-ready app
4. **No file size validation UI** — backend enforces 20MB max but frontend doesn't pre-check
5. **No retry UX for failed uploads** — user must re-upload manually
6. **SQLite storage** — fine for demo, would need migration for production scale

---

## Troubleshooting

### Backend won't start
- Check `GEMINI_API_KEY` is set in `backend/.env`
- Ensure virtual environment is activated
- Check port 8000 isn't already in use

### Frontend can't connect to backend
- Backend must be running on `localhost:8000`
- Check CORS settings in `main.py` include your frontend port
- Check browser console for CORS errors

### Extraction fails or returns low confidence
- Check document file size (max 20MB)
- Try a clearer scan or typed text version
- Check Gemini API quota/rate limits

### Timeline doesn't populate after upload
- Check browser console for errors
- Check backend logs for extraction failures
- Verify document type is recognized (appointment_letter or discharge_summary)

### Check-ins don't flag when expected
- Flagging only works if `warning_signs` were extracted from discharge summary
- Check the `flagging_criteria` on the CheckinRecord in the API response
- Scale threshold must be met (usually ≥4 on a 1-5 scale)

---

## Demo Script (Day 7 Presentation)

1. Open `http://localhost:5173` — empty timeline appears
2. Upload `sample-documents/appointment_letter_sample.txt`
3. Watch preparation checklist populate with source tags
4. Tap a source tag → see original extracted field in popover
5. Upload `sample-documents/discharge_summary_sample.txt`
6. Watch action plan, medications, follow-ups, check-ins populate
7. In Check-ins section: enter "1" → click "Trigger check-in"
8. Respond with scale value 5 → flag appears citing exact warning sign
9. Show source tag on flag → see the matched warning sign from discharge doc
10. Toggle A+ (large text) and ◑ (high contrast) — verify accessibility

---

## Further Reading

- **GEMINI.md** — AI agent rules, the two-role architecture, and build constraints
- **DESIGN.md** — Complete design system, component specs, motion rules
- **CareLoop_PRD_Indepth.md** — Full product rationale, personas, acceptance criteria
- **docs/schemas/*.json** — JSON schemas for document extraction

---

## Contributing (Post-Hackathon)

If this project continues beyond the hackathon:
1. Add proper authentication + multi-user support
2. Replace "Simulate Day N" with a real job scheduler
3. Add comprehensive test suite (pytest for backend, Vitest for frontend)
4. Implement P1 features (during-flow, full accessibility suite)
5. Add proper error boundaries and retry logic
6. Consider migrating from SQLite to PostgreSQL for production
7. Add proper logging and monitoring
8. Security audit (input validation, rate limiting, secret management)

For now, this is a 7-day hackathon build — optimized for demo impact, not production deployment.

---

**Last modified:** 2026-09-27  
**Status:** Hackathon build — P0 features complete, ready for demo
