"""Safe API boundary for deterministic CareLoop Copilot grounding.

This router intentionally exposes evidence only. It does not generate an
answer, call an LLM, persist conversation history, or use external knowledge.
"""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from copilot_answers import answer_copilot_question, copilot_generation_path
from copilot_grounding import ground_from_storage
from models import CopilotAnswerResponse, CopilotAskRequest, CopilotGroundingResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.post("/ground", response_model=CopilotGroundingResult)
async def ground_copilot_question(
    body: CopilotAskRequest,
    request: Request,
) -> CopilotGroundingResult:
    """Return only deterministic, provenance-aware evidence for a question."""
    request_id = request.headers.get("X-Request-ID") or str(uuid4())

    try:
        result = ground_from_storage(body)
    except Exception:
        logger.exception("copilot_grounding_failed request_id=%s", request_id)
        raise HTTPException(
            status_code=500,
            detail="CareLoop could not retrieve your recorded care right now.",
        ) from None

    logger.info(
        "copilot_grounded request_id=%s intent=%s evidence_count=%d supported=%s",
        request_id,
        result.intent.value,
        len(result.evidence),
        result.supported,
    )
    return result


@router.post("/ask", response_model=CopilotAnswerResponse)
async def ask_copilot_question(
    body: CopilotAskRequest,
    request: Request,
) -> CopilotAnswerResponse:
    """Return a grounded answer with citations and no external knowledge."""
    request_id = request.headers.get("X-Request-ID") or str(uuid4())

    try:
        grounding = ground_from_storage(body)
        result = await answer_copilot_question(body, grounding)
    except Exception:
        logger.exception("copilot_answer_failed request_id=%s", request_id)
        raise HTTPException(
            status_code=500,
            detail="CareLoop could not prepare an answer from your recorded care right now.",
        ) from None

    logger.info(
        "copilot_answered request_id=%s intent=%s evidence_count=%d answer_type=%s generation_path=%s validation_result=%s",
        request_id,
        result.intent.value,
        len(result.citations),
        result.answer_type.value,
        copilot_generation_path(body, grounding),
        result.safety.validation_passed,
    )
    return result
