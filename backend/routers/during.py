"""
CareLoop — During-Flow Router

Handles:
  POST /api/episodes/{id}/during   — capture typed notes from a visit
  GET  /api/episodes/{id}/during   — list during-flow notes for an episode
"""

from fastapi import APIRouter, HTTPException

import database
from extraction.generator import generate_during_flow
from models import DuringNote, DuringNoteRequest

router = APIRouter(prefix="/api/episodes", tags=["during"])


@router.post("/{episode_id}/during", status_code=201)
async def capture_during_note(episode_id: str, body: DuringNoteRequest):
    """
    Capture and structure patient notes from during the appointment.

    Input: patient's free-text notes from the visit
    Output: structured visit summary added to the episode timeline
    """
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")

    if not body.notes.strip():
        raise HTTPException(status_code=400, detail="Notes cannot be empty.")

    question_text = None
    if body.question_id:
        prepared_questions = episode.before.suggested_questions if episode.before else []
        prepared_question = next(
            (question for question in prepared_questions if question.question_id == body.question_id),
            None,
        )
        if prepared_question is None:
            raise HTTPException(status_code=400, detail="That prepared question is not part of this care journey.")
        question_text = prepared_question.question

    # Generate structured summary (During-flow generator — P1 feature)
    structured = await generate_during_flow(body.notes)

    note = DuringNote(
        raw_text=body.notes,
        structured_summary=structured,
        question_id=body.question_id,
        question_text=question_text,
    )
    episode.during.append(note)
    database.save_episode(episode)

    return note


@router.get("/{episode_id}/during")
async def get_during_notes(episode_id: str):
    """List all during-flow notes for an episode."""
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode.during
