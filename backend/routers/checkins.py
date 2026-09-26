"""
CareLoop — Check-ins Router

Handles:
  GET  /api/episodes/{id}/checkins              — list all check-ins for an episode
  POST /api/episodes/{id}/checkins/{cid}/respond — submit a response to a check-in
  POST /api/episodes/{id}/checkins/simulate      — "Simulate Day N" demo control

Flagging logic:
  - Only matches patient responses against warning_signs from the patient's
    own extracted document (via flagging_criteria on each CheckinRecord).
  - Never uses external medical knowledge or hardcoded symptom lists.
"""

from fastapi import APIRouter, HTTPException

import database
from models import CheckinResponse, CheckinResponseRequest, SimulateDayRequest

router = APIRouter(prefix="/api/episodes", tags=["checkins"])


# ── Flagging logic ─────────────────────────────────────────────────────────────


def _evaluate_flag(record, response: CheckinResponseRequest) -> tuple[bool, str | None]:
    """
    Determine if a check-in response should be flagged.

    ONLY matches against flagging_criteria derived from the patient's own
    extracted warning_signs — never a general medical knowledge base.

    Returns: (flagged: bool, matched_warning_sign: str | None)
    """
    criteria = record.flagging_criteria
    flagged = False
    matched = None

    if record.response_type == "scale_1_5":
        threshold = criteria.scale_threshold
        if threshold is not None and isinstance(response.response_value, (int, float)):
            if response.response_value >= threshold:
                flagged = True
                matched = criteria.matched_warning_sign

    elif record.response_type == "text":
        text = str(response.response_value).lower()
        for keyword in criteria.text_keywords:
            if keyword.lower() in text:
                flagged = True
                matched = criteria.matched_warning_sign
                break

    elif record.response_type == "yes_no":
        # "yes" on a yes/no check-in about a warning sign = flagged
        if response.response_value is True or str(response.response_value).lower() == "yes":
            if criteria.matched_warning_sign:
                flagged = True
                matched = criteria.matched_warning_sign

    return flagged, matched


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.get("/{episode_id}/checkins")
async def list_checkins(episode_id: str):
    """List all check-ins for an episode with their status."""
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode.checkins


@router.post("/{episode_id}/checkins/{checkin_id}/respond")
async def respond_to_checkin(
    episode_id: str,
    checkin_id: str,
    body: CheckinResponseRequest,
):
    """
    Submit a patient response to a check-in prompt.

    Evaluates the response against the patient's own warning signs and
    flags if criteria are met.
    """
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")

    record = next((c for c in episode.checkins if c.checkin_id == checkin_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Check-in not found")

    if record.response is not None:
        raise HTTPException(
            status_code=409, detail="This check-in already has a response."
        )

    # Validate response type matches expected
    if body.response_type != record.response_type:
        raise HTTPException(
            status_code=400,
            detail=f"Expected response_type '{record.response_type}', got '{body.response_type}'",
        )

    # Record response
    from datetime import datetime
    record.response = CheckinResponse(
        response_type=body.response_type,
        response_value=body.response_value,
        submitted_at=datetime.utcnow(),
    )

    # Evaluate flagging — ONLY against patient's own warning signs
    flagged, matched = _evaluate_flag(record, body)
    record.flagged = flagged
    record.matched_warning_sign = matched

    database.save_episode(episode)

    return {
        "checkin_id": checkin_id,
        "flagged": flagged,
        "matched_warning_sign": matched,
        "flag_message": (
            f'This matches a warning sign from your discharge instructions: "{matched}". '
            "Consider contacting your care provider."
            if flagged and matched
            else None
        ),
        "record": record,
    }


@router.post("/{episode_id}/checkins/simulate")
async def simulate_day(episode_id: str, body: SimulateDayRequest):
    """
    DEMO / DEV CONTROL — Simulate Day N to trigger a check-in for demonstration.

    This is explicitly a hackathon demo affordance. It is labelled as such
    in both the UI and the API response. It does not affect the flagging logic
    or any real scheduling.

    Returns the check-in record for the specified day (if one is scheduled).
    """
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")

    # Find the check-in scheduled for this day
    record = next(
        (c for c in episode.checkins if c.scheduled_for_day == body.day), None
    )

    if record is None:
        return {
            "demo_mode": True,
            "simulated_day": body.day,
            "message": f"No check-in scheduled for day {body.day}. Available days: "
            + str([c.scheduled_for_day for c in episode.checkins]),
            "checkin": None,
        }

    record.simulated = True
    database.save_episode(episode)

    return {
        "demo_mode": True,  # Explicit — never hide that this is simulated
        "simulated_day": body.day,
        "message": f"[DEMO] Simulating day {body.day} check-in. In production, this would be triggered by the scheduler.",
        "checkin": record,
    }
