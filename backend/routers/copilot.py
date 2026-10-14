"""Safe API boundary for grounded CareLoop Copilot answers.

Grounding remains deterministic and scoped. Gemini is called only after
retrieved evidence passes through the answer-routing and validation layers.
"""

import logging
import re
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, status

import database
from copilot_answers import CopilotSynthesisError, answer_copilot_question, copilot_generation_path
from copilot_grounding import ground_from_storage
from models import (
    CopilotAnswerResponse,
    CopilotAskRequest,
    CopilotConversationCreateRequest,
    CopilotConversationDetail,
    CopilotConversationSummary,
    CopilotGroundingResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


def _conversation_title(question: str) -> str:
    normalized = re.sub(r"\s+", " ", question.strip()).rstrip("?.!")
    lowered = normalized.lower()
    if "warning" in lowered or "watch for" in lowered:
        return "Warning signs"
    if "summar" in lowered or "care journey" in lowered or "recorded care" in lowered:
        return "Care journey summary"
    if "follow" in lowered or "return" in lowered:
        return "Follow-up information"
    if "write" in lowered or "visit note" in lowered or "appointment" in lowered:
        return "Visit notes"
    return normalized[:56] + ("…" if len(normalized) > 56 else "")


def _conversation_or_404(conversation_id: str) -> dict:
    conversation = database.get_copilot_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="That conversation is not available.")
    return conversation


@router.get("/conversations", response_model=list[CopilotConversationSummary])
async def list_copilot_conversations() -> list[dict]:
    return database.list_copilot_conversations()


@router.post("/conversations", response_model=CopilotConversationDetail, status_code=status.HTTP_201_CREATED)
async def create_copilot_conversation(
    _: CopilotConversationCreateRequest,
) -> dict:
    return database.create_copilot_conversation()


@router.get("/conversations/{conversation_id}", response_model=CopilotConversationDetail)
async def get_copilot_conversation(
    conversation_id: str,
) -> dict:
    return _conversation_or_404(conversation_id)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_copilot_conversation(
    conversation_id: str,
) -> None:
    if not database.delete_copilot_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="That conversation is not available.")


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

    conversation_id = body.conversation_id
    if conversation_id:
        _conversation_or_404(conversation_id)
    elif body.persist_user_message:
        conversation_id = database.create_copilot_conversation(_conversation_title(body.question))["id"]

    if conversation_id and body.persist_user_message:
        database.append_copilot_message(conversation_id, role="user", text=body.question.strip())
        if database.get_copilot_conversation(conversation_id)["title"] == "New conversation":
            database.update_copilot_title(conversation_id, _conversation_title(body.question))

    try:
        grounding = ground_from_storage(body)
        diagnostics: dict[str, object] = {}
        result = await answer_copilot_question(body, grounding, diagnostics)
    except CopilotSynthesisError:
        logger.warning(
            "copilot_answered request_id=%s intent=%s evidence_count=%d answer_type=service_error generation_path=%s model=%s validation_passed=%s provider_latency_ms=%s",
            request_id,
            grounding.intent.value if "grounding" in locals() else "unknown",
            len(grounding.evidence) if "grounding" in locals() else 0,
            copilot_generation_path(body, grounding) if "grounding" in locals() else "gemini",
            diagnostics.get("model", "unknown"),
            False,
            diagnostics.get("provider_latency_ms", "unknown"),
        )
        raise HTTPException(
            status_code=503,
            detail="CareLoop couldn't check your recorded care right now. Please try again.",
        ) from None
    except Exception:
        logger.exception("copilot_answer_failed request_id=%s", request_id)
        raise HTTPException(
            status_code=500,
            detail="CareLoop could not prepare an answer from your recorded care right now.",
        ) from None

    logger.info(
        "copilot_answered request_id=%s intent=%s evidence_count=%d answer_type=%s generation_path=%s model=%s validation_passed=%s provider_latency_ms=%s",
        request_id,
        result.intent.value,
        len(grounding.evidence),
        result.answer_type.value,
        copilot_generation_path(body, grounding),
        diagnostics.get("model", "not_applicable"),
        result.safety.validation_passed,
        diagnostics.get("provider_latency_ms", "not_applicable"),
    )
    result_with_conversation = result.model_copy(update={"conversation_id": conversation_id})
    if conversation_id:
        database.append_copilot_message(
            conversation_id,
            role="assistant",
            text=result.answer,
            response=result_with_conversation.model_dump(mode="json"),
        )
    return result_with_conversation
