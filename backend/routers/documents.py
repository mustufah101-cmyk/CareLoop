"""
CareLoop — Documents Router

Handles:
  POST /api/episodes/{id}/documents           — upload a document (PDF/image/text)
  GET  /api/episodes/{id}/documents/{doc_id}  — get a document's extracted JSON

Upload flow:
  1. Receive file
  2. classify_document() → doc type
  3. extract_structured() → JSON
  4. Trigger Before or After flow generation depending on doc type
  5. Save updated episode
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile

import database
from extraction.extractor import process_document
from extraction.generator import generate_after_flow, generate_before_flow, generate_checkin_schedule
from models import (
    ActionPlanInstruction,
    ActionPlanMilestone,
    AfterFlowOutput,
    BeforeFlowOutput,
    CheckinRecord,
    ChecklistItem,
    DocumentRecord,
    DuringNote,
    FlaggingCriteria,
    FollowUpSummary,
    MedicationSummary,
    Reminder,
    ScaleLabels,
    SuggestedQuestion,
)

router = APIRouter(prefix="/api/episodes", tags=["documents"])

# Max upload size: 20 MB
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@router.post("/{episode_id}/documents", status_code=201)
async def upload_document(episode_id: str, file: UploadFile = File(...)):
    """
    Upload a document (PDF, image, or text) to a care episode.

    This triggers the full pipeline:
      - Document classification
      - Structured extraction (Extractor role)
      - Before/After flow generation (Generator role)
      - Check-in schedule generation (for discharge summaries)
    """
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 20 MB.")
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    filename = file.filename or "upload"

    # ── Step 1 & 2: Classify + Extract ───────────────────────────────────────
    result = await process_document(file_bytes, filename)

    # Handle wrong document type
    if result.get("error") == "wrong_document_type":
        raise HTTPException(
            status_code=422,
            detail={
                "error": "wrong_document_type",
                "message": result["message"],
                "detected_type": result["classification"]["document_type"],
            },
        )

    doc_type = result["doc_type"]
    extracted_json = result["extracted_json"]

    # Create DocumentRecord
    doc = DocumentRecord(
        file_name=filename,
        doc_type=doc_type,
        extracted_json=extracted_json,
        uploaded_at=datetime.utcnow(),
    )
    episode.documents.append(doc)

    # ── Step 3: Trigger generation based on doc type ──────────────────────────

    if doc_type == "appointment_letter":
        # Before-flow generation
        before_data = await generate_before_flow(extracted_json)
        episode.before = BeforeFlowOutput()

        checklist_items = []
        for raw_item in before_data.get("checklist", []):
            item_text = (
                raw_item.get("item")
                or raw_item.get("label")
                or raw_item.get("instruction")
                or raw_item.get("text")
                or "Preparation item"
            )
            checklist_items.append(
                ChecklistItem(
                    item=item_text,
                    relative_time=raw_item.get("relative_time"),
                    category=raw_item.get("category", "general"),
                    done=bool(raw_item.get("done", False)),
                    source_field=raw_item.get("source_field", "appointment_letter"),
                )
            )
        episode.before.checklist = checklist_items

        reminders = []
        for r in before_data.get("reminders", []):
            reminders.append(
                Reminder(
                    message=r.get("message") or r.get("text") or "Reminder",
                    trigger_offset_hours=int(r.get("trigger_offset_hours", -24)),
                    source_field=r.get("source_field", "appointment_letter"),
                )
            )
        episode.before.reminders = reminders

        questions = []
        for q in before_data.get("suggested_questions", []):
            questions.append(
                SuggestedQuestion(
                    question=q.get("question") or q.get("text") or "Question for clinician",
                    reason=q.get("reason", ""),
                    source_field=q.get("source_field", "appointment_letter"),
                )
            )
        episode.before.suggested_questions = questions

        # Update episode appointment type if extracted
        if extracted_json.get("appointment_type"):
            episode.appointment_type = extracted_json["appointment_type"]

    elif doc_type == "discharge_summary":
        # After-flow generation
        after_data = await generate_after_flow(extracted_json)

        action_milestones = []
        for m in after_data.get("action_plan", []):
            instructions = []
            for i in m.get("instructions", []):
                text = i.get("text") or i.get("instruction") or i.get("item") or "Care instruction"
                instructions.append(
                    ActionPlanInstruction(
                        text=text,
                        category=i.get("category", "general"),
                        source_field=i.get("source_field", "discharge_summary"),
                    )
                )
            action_milestones.append(
                ActionPlanMilestone(
                    milestone=m.get("milestone", "Recovery milestone"),
                    instructions=instructions,
                )
            )

        meds = []
        for m in after_data.get("medications_summary", []):
            meds.append(
                MedicationSummary(
                    name=m.get("name", "Medication"),
                    plain_instruction=m.get("plain_instruction") or m.get("instruction") or "",
                    source_field=m.get("source_field", "discharge_summary"),
                )
            )

        follow_ups = []
        for f in after_data.get("follow_up_summary", []):
            follow_ups.append(
                FollowUpSummary(
                    plain_instruction=f.get("plain_instruction") or f.get("instruction") or "",
                    timeframe=f.get("timeframe"),
                    source_field=f.get("source_field", "discharge_summary"),
                )
            )

        episode.after = AfterFlowOutput(
            action_plan=action_milestones,
            medications_summary=meds,
            follow_up_summary=follow_ups,
        )

        # Check-in schedule generation
        checkin_data = await generate_checkin_schedule(extracted_json)
        checkin_records = []
        for c in checkin_data.get("checkin_schedule", []):
            scale_labels_data = c.get("scale_labels") or {}
            flagging_criteria_data = c.get("flagging_criteria") or {}
            checkin_records.append(
                CheckinRecord(
                    scheduled_for_day=int(c.get("day", 1)),
                    prompt_text=c.get("prompt_text", "How are you feeling today?"),
                    response_type=c.get("response_type", "scale_1_5"),
                    scale_labels=ScaleLabels(**scale_labels_data),
                    flagging_criteria=FlaggingCriteria(**flagging_criteria_data),
                    source_field=c.get("source_field", "discharge_summary"),
                )
            )
        episode.checkins = checkin_records

    else:
        # Clinical handout / diagnosis letter / referral / prescription
        during_note = DuringNote(
            raw_text=extracted_json.get("summary") or filename,
            structured_summary={
                "summary": extracted_json.get("summary") or "Clinical Document Summary",
                "action_items": extracted_json.get("action_items", []),
                "general_info": extracted_json.get("general_info", []),
            },
            captured_at=datetime.utcnow(),
        )
        episode.during.append(during_note)

        # Populate Before checklist or After action plan if empty
        action_items = extracted_json.get("action_items", [])
        if action_items:
            if not episode.before or not episode.before.checklist:
                episode.before = BeforeFlowOutput(
                    checklist=[
                        ChecklistItem(
                            item=item.get("instruction") or item.get("item") or "Care instruction",
                            relative_time=item.get("timing"),
                            category="treatment",
                            source_field=doc_type,
                        )
                        for item in action_items
                    ]
                )
            if not episode.after or not episode.after.action_plan:
                episode.after = AfterFlowOutput(
                    action_plan=[
                        ActionPlanMilestone(
                            milestone="Treatment & Recommendations",
                            instructions=[
                                ActionPlanInstruction(
                                    text=item.get("instruction") or item.get("item") or "Care instruction",
                                    category="treatment",
                                    source_field=doc_type,
                                )
                                for item in action_items
                            ],
                        )
                    ]
                )

        if extracted_json.get("warning_signs") and not episode.checkins:
            checkin_data = await generate_checkin_schedule(extracted_json)
            episode.checkins = [
                CheckinRecord(
                    scheduled_for_day=int(c.get("day", 1)),
                    prompt_text=c.get("prompt_text", "How are you feeling today?"),
                    response_type=c.get("response_type", "scale_1_5"),
                    scale_labels=ScaleLabels(** (c.get("scale_labels") or {}) ),
                    flagging_criteria=FlaggingCriteria(** (c.get("flagging_criteria") or {}) ),
                    source_field=c.get("source_field", doc_type),
                )
                for c in checkin_data.get("checkin_schedule", [])
            ]

    # ── Save updated episode ──────────────────────────────────────────────────
    database.save_episode(episode)

    return {
        "doc_id": doc.doc_id,
        "doc_type": doc_type,
        "filename": filename,
        "extraction_confidence": extracted_json.get("extraction_confidence"),
        "low_confidence_warning": extracted_json.get("_low_confidence_warning"),
        "episode": episode,
    }


@router.get("/{episode_id}/documents/{doc_id}")
async def get_document(episode_id: str, doc_id: str):
    """Get a document's extracted JSON and metadata."""
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")

    doc = next((d for d in episode.documents if d.doc_id == doc_id), None)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    return doc
