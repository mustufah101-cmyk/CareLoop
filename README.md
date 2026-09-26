# CareLoop

An AI copilot that follows one patient through a healthcare episode — **Before**, **During**, and **After** their appointment.

Every patient-facing instruction is traceable to a real clinician-authored document. CareLoop translates, structures, and follows through — it does not diagnose or invent medical content.

> **Hackathon build** — 7-day sprint, Track: Accessibility & Health

---

## Quick Start

### 1. Backend

```powershell
cd backend
# Activate the virtual environment
.\venv\Scripts\Activate.ps1

# Copy .env.example and fill in your Gemini API key
cp .env.example .env
# Edit .env: set GEMINI_API_KEY=your_real_key_here

# Start the API server
uvicorn main:app --reload
# → API running at http://localhost:8000
# → Swagger docs at http://localhost:8000/docs
```

### 2. Frontend

```powershell
cd frontend
npm run dev
# → App running at http://localhost:5173
```

### 3. Test the pipeline

Upload one of the sample documents from `sample-documents/`:
- `appointment_letter_sample.txt` → triggers Before-flow (checklist, reminders, questions)
- `discharge_summary_sample.txt` → triggers After-flow (action plan, check-ins)

Then use **Simulate Day N** in the UI to trigger a check-in.

---

## Project Structure

```
Care - Loop/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── database.py                # SQLite storage layer
│   ├── models.py                  # Pydantic data models
│   ├── requirements.txt           # Python dependencies
│   ├── venv/                      # Python virtual environment
│   ├── extraction/
│   │   ├── extractor_prompts.py   # LLM prompt templates (Extractor + Generator roles)
│   │   ├── extractor.py           # Document classifier + structured extraction
│   │   └── generator.py          # Before/After/Check-in/During generators
│   └── routers/
│       ├── episodes.py            # Episode CRUD
│       ├── documents.py           # File upload + pipeline trigger
│       ├── checkins.py            # Check-in responses + "Simulate Day N"
│       └── during.py             # During-flow note capture
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root + accessibility toggles
│   │   ├── index.css             # Full design system (tokens, components, timeline)
│   │   ├── api.js                # API client
│   │   ├── components/
│   │   │   ├── Timeline.jsx       # Spine + all phase sections
│   │   │   ├── ActionItem.jsx     # Checkable instruction + source tag
│   │   │   ├── InfoCard.jsx      # Non-actionable info + source tag
│   │   │   ├── CheckinCard.jsx   # Tap-scale response + flagging display
│   │   │   ├── DocumentUpload.jsx # Upload widget + processing animation
│   │   │   └── SourceTag.jsx     # Source tag + popover (required on all patient-facing items)
│   │   └── pages/
│   │       └── EpisodePage.jsx   # Main episode page
│   └── vite.config.js
├── docs/
│   ├── CareLoop_PRD_Indepth.md   # Full product requirements
│   └── schemas/
│       ├── appointment_letter.json  # Extraction schema: appointment letters
│       ├── discharge_summary.json   # Extraction schema: discharge summaries
│       └── generic_handout.json     # Fallback schema
├── sample-documents/
│   ├── appointment_letter_sample.txt
│   ├── discharge_summary_sample.txt
│   └── README.md
├── DESIGN.md                      # Frontend design system reference
├── GEMINI.md                      # AI agent rules + architecture constraints
└── .env.example                   # Environment variable template
```

---

## Architecture

Two strict LLM roles — never merged (per GEMINI.md):

1. **Extractor** — receives raw document → returns schema-enforced JSON only
2. **Generator** — receives structured JSON only → returns patient-facing text

Every patient-facing UI element carries a `source_field` tag pointing to the originating document field.

---

## Key Rules (from GEMINI.md)

- Every patient-facing instruction must be traceable to a field extracted from a clinician-authored source document
- Generators only consume structured JSON — never raw document text
- Flagging logic only matches against `warning_signs` from the patient's own extracted document
- If a field is missing → output "not specified", never infer

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key (vision-capable model) |
| `DATABASE_URL` | No | SQLite path (default: `sqlite:///./careloop.db`) |
| `PORT` | No | Backend port (default: 8000) |
| `VITE_API_BASE_URL` | No | Backend URL for frontend (default: `http://localhost:8000`) |

---

## Demo Script (Day 7)

1. Open `http://localhost:5173` — empty timeline appears
2. Upload `sample-documents/appointment_letter_sample.txt`
3. Watch: checklist, suggested questions populate with source tags
4. Tap a source tag → see original extracted field
5. Upload `sample-documents/discharge_summary_sample.txt`
6. Watch: action plan, medication list, follow-up summary populate
7. In the Check-ins section: enter "1" → click "Trigger check-in"
8. Respond to the check-in with scale value 4 or 5 → flag appears
9. Show: flag cites exact warning sign from the discharge document
10. Toggle A+ (large text) and ◑ (high contrast) — verify accessibility
