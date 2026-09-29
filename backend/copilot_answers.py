"""Grounded Copilot answer construction and post-generation validation."""

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from extraction.copilot_generator import generate_copilot_synthesis
from models import (
    CopilotAnswerResponse,
    CopilotAnswerSegment,
    CopilotAnswerType,
    CopilotAskRequest,
    CopilotEvidence,
    CopilotGroundingResult,
    CopilotIntent,
    CopilotSafety,
)


NOT_FOUND_TEXT = "I could not find that information in your recorded care."
UNSUPPORTED_TEXT = "I can’t determine that from your recorded care. I can only help you find information already recorded in CareLoop."


class CopilotAnswerValidationError(ValueError):
    """Raised when an answer cannot be proven safe against retrieved evidence."""


class _GeneratedSegment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=4000)
    citation_ids: list[str] = Field(default_factory=list)


class _GeneratedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer_type: CopilotAnswerType
    supported: bool
    segments: list[_GeneratedSegment] = Field(default_factory=list)


async def answer_copilot_question(
    request: CopilotAskRequest,
    grounding: CopilotGroundingResult,
) -> CopilotAnswerResponse:
    """Return a deterministic answer or validated evidence-only synthesis."""
    if grounding.intent == CopilotIntent.UNSUPPORTED_MEDICAL_JUDGMENT:
        return _unsupported_response(grounding)
    if not grounding.evidence or not grounding.supported:
        return _not_found_response(grounding)

    if not _needs_synthesis(request.question, grounding):
        return _validated_deterministic_response(grounding)

    try:
        generated = await generate_copilot_synthesis(
            request.question,
            [item.model_dump(mode="json") for item in grounding.evidence],
        )
        payload = _GeneratedPayload.model_validate(generated)
        response = _response_from_generated(payload, grounding)
        validate_copilot_answer(response, grounding, generated_with_llm=True)
        return response
    except Exception:
        # Never expose malformed model output. Fall back to a deterministic
        # source listing that remains grounded in the retrieved evidence.
        return _deterministic_response(
            grounding,
            generated_with_llm=True,
            validation_passed=False,
        )


def validate_copilot_answer(
    response: CopilotAnswerResponse,
    grounding: CopilotGroundingResult,
    *,
    generated_with_llm: bool,
) -> None:
    """Validate citations, support state, provenance, and obvious unsafe claims."""
    evidence_by_id = {item.evidence_id: item for item in grounding.evidence}
    if response.intent != grounding.intent:
        raise CopilotAnswerValidationError("Answer intent does not match grounding intent")
    if response.supported and not grounding.evidence:
        raise CopilotAnswerValidationError("Supported answer has no evidence")
    if response.answer_type == CopilotAnswerType.GROUNDED:
        if not response.supported or not response.segments:
            raise CopilotAnswerValidationError("Grounded answer is missing support or segments")
        for segment in response.segments:
            if not segment.citation_ids:
                raise CopilotAnswerValidationError("Substantive grounded segment is uncited")
    elif response.supported:
        raise CopilotAnswerValidationError("Unsupported or not-found answer cannot be supported")

    referenced_ids = {citation_id for segment in response.segments for citation_id in segment.citation_ids}
    if not referenced_ids.issubset(evidence_by_id):
        raise CopilotAnswerValidationError("Answer cites evidence that was not retrieved")
    if any(citation.evidence_id not in evidence_by_id for citation in response.citations):
        raise CopilotAnswerValidationError("Response contains an ungrounded citation")
    if {citation.evidence_id for citation in response.citations} != referenced_ids:
        raise CopilotAnswerValidationError("Response citations do not match segment citations")
    if generated_with_llm and any(_contains_unsafe_medical_claim(segment.text) for segment in response.segments):
        raise CopilotAnswerValidationError("Generated answer contains an unsupported medical claim")


def _needs_synthesis(question: str, grounding: CopilotGroundingResult) -> bool:
    if grounding.intent not in {CopilotIntent.CARE_HISTORY_LOOKUP, CopilotIntent.VISIT_NOTE_LOOKUP}:
        return False
    if len(grounding.evidence) < 2:
        return False
    normalized = question.lower()
    return any(term in normalized for term in ("summarize", "summary", "compare", "across", "overall", "tell me about"))


def _validated_deterministic_response(grounding: CopilotGroundingResult) -> CopilotAnswerResponse:
    response = _deterministic_response(grounding)
    validate_copilot_answer(response, grounding, generated_with_llm=False)
    return response


def _response_from_generated(payload: _GeneratedPayload, grounding: CopilotGroundingResult) -> CopilotAnswerResponse:
    segments = [CopilotAnswerSegment.model_validate(segment.model_dump()) for segment in payload.segments]
    citations = _citations_for_segments(segments, grounding.evidence)
    answer = "\n\n".join(segment.text for segment in segments).strip()
    return CopilotAnswerResponse(
        answer=answer,
        answer_type=payload.answer_type,
        supported=payload.supported,
        intent=grounding.intent,
        segments=segments,
        citations=citations,
        related_episode_ids=grounding.related_episode_ids,
        safety=CopilotSafety(
            medical_judgment_detected=grounding.medical_judgment_detected,
            used_only_recorded_care=True,
            generated_with_llm=True,
            validation_passed=True,
        ),
    )


def _deterministic_response(
    grounding: CopilotGroundingResult,
    *,
    generated_with_llm: bool = False,
    validation_passed: bool = True,
) -> CopilotAnswerResponse:
    if grounding.intent == CopilotIntent.CARE_HISTORY_LOOKUP and grounding.evidence:
        return _care_history_response(
            grounding,
            generated_with_llm=generated_with_llm,
            validation_passed=validation_passed,
        )

    segments: list[CopilotAnswerSegment] = []
    for item in grounding.evidence:
        segments.append(CopilotAnswerSegment(
            text=_evidence_sentence(grounding.intent, item),
            citation_ids=[item.evidence_id],
        ))
    answer_type = CopilotAnswerType.GROUNDED if segments else CopilotAnswerType.NOT_FOUND
    if not segments:
        segments = [CopilotAnswerSegment(text=NOT_FOUND_TEXT)]
    response = CopilotAnswerResponse(
        answer="\n\n".join(segment.text for segment in segments),
        answer_type=answer_type,
        supported=bool(grounding.evidence),
        intent=grounding.intent,
        segments=segments,
        citations=_citations_for_segments(segments, grounding.evidence),
        related_episode_ids=grounding.related_episode_ids,
        safety=CopilotSafety(
            medical_judgment_detected=grounding.medical_judgment_detected,
            used_only_recorded_care=True,
            generated_with_llm=generated_with_llm,
            validation_passed=validation_passed,
        ),
    )
    return response


def _care_history_response(
    grounding: CopilotGroundingResult,
    *,
    generated_with_llm: bool,
    validation_passed: bool,
) -> CopilotAnswerResponse:
    """Present recorded episode metadata without exposing storage timestamps."""
    evidence_by_episode: dict[str, list[CopilotEvidence]] = {}
    for item in grounding.evidence:
        evidence_by_episode.setdefault(item.episode_id, []).append(item)

    lines = [f"You have {len(evidence_by_episode)} recorded care journeys:"]
    citation_ids: list[str] = []
    for episode_evidence in evidence_by_episode.values():
        appointment = next(
            (item for item in episode_evidence if item.source_field == "appointment_type"),
            None,
        )
        created = next(
            (item for item in episode_evidence if item.source_field == "created_at"),
            None,
        )
        title = _value_text(appointment.evidence_value) if appointment else "Care journey"
        added_date = _human_date(created.evidence_value) if created else None
        detail = f"{title} — added {added_date}" if added_date else title
        lines.append(detail)
        citation_ids.extend(item.evidence_id for item in episode_evidence)

    segment = CopilotAnswerSegment(text="\n".join(lines), citation_ids=citation_ids)
    return CopilotAnswerResponse(
        answer=segment.text,
        answer_type=CopilotAnswerType.GROUNDED,
        supported=True,
        intent=grounding.intent,
        segments=[segment],
        citations=_citations_for_segments([segment], grounding.evidence),
        related_episode_ids=grounding.related_episode_ids,
        safety=CopilotSafety(
            medical_judgment_detected=grounding.medical_judgment_detected,
            used_only_recorded_care=True,
            generated_with_llm=generated_with_llm,
            validation_passed=validation_passed,
        ),
    )


def _unsupported_response(grounding: CopilotGroundingResult) -> CopilotAnswerResponse:
    segments = [CopilotAnswerSegment(text=UNSUPPORTED_TEXT)]
    if grounding.evidence:
        segments.append(CopilotAnswerSegment(
            text="Your recorded care lists: " + "; ".join(_value_text(item.evidence_value) for item in grounding.evidence),
            citation_ids=[item.evidence_id for item in grounding.evidence],
        ))
    return CopilotAnswerResponse(
        answer="\n\n".join(segment.text for segment in segments),
        answer_type=CopilotAnswerType.UNSUPPORTED,
        supported=False,
        intent=grounding.intent,
        segments=segments,
        citations=_citations_for_segments(segments, grounding.evidence),
        related_episode_ids=grounding.related_episode_ids,
        safety=CopilotSafety(
            medical_judgment_detected=True,
            used_only_recorded_care=True,
            generated_with_llm=False,
            validation_passed=True,
        ),
    )


def _not_found_response(grounding: CopilotGroundingResult) -> CopilotAnswerResponse:
    response = _deterministic_response(grounding)
    response.answer_type = CopilotAnswerType.NOT_FOUND
    response.supported = False
    response.answer = NOT_FOUND_TEXT
    response.segments = [CopilotAnswerSegment(text=NOT_FOUND_TEXT)]
    response.citations = []
    return response


def _citations_for_segments(segments: list[CopilotAnswerSegment], evidence: list[CopilotEvidence]) -> list[CopilotEvidence]:
    ids = {citation_id for segment in segments for citation_id in segment.citation_ids}
    return [item for item in evidence if item.evidence_id in ids]


def _evidence_sentence(intent: CopilotIntent, item: CopilotEvidence) -> str:
    value = item.evidence_value
    if intent == CopilotIntent.VISIT_NOTE_LOOKUP:
        prefix = "Your visit note says" if item.source_field == "during.raw_text" else "Your recorded visit summary says"
    elif intent == CopilotIntent.WARNING_SIGN_LOOKUP:
        prefix = "Your recorded care lists this warning sign"
    elif intent == CopilotIntent.CARE_HISTORY_LOOKUP:
        prefix = "Your recorded care journey includes"
    elif intent == CopilotIntent.CHECKIN_HISTORY_LOOKUP:
        prefix = "Your recorded check-in says"
    elif intent == CopilotIntent.FOLLOW_UP_LOOKUP:
        prefix = "Your recorded follow-up information says"
    else:
        prefix = "Your recorded instructions say"
    return f"{prefix}: {_value_text(value)}."


def _value_text(value: Any) -> str:
    if isinstance(value, dict):
        parts = []
        for key, item in value.items():
            if item is None or item == "" or item == []:
                continue
            if key in {"flagging_criteria", "scale_labels"}:
                continue
            label = key.replace("_", " ")
            parts.append(f"{label}: {_value_text(item)}")
        return "; ".join(parts) or "not specified"
    if isinstance(value, list):
        return "; ".join(_value_text(item) for item in value)
    return str(value)


def _human_date(value: Any) -> str | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    return f"{parsed.strftime('%B')} {parsed.day}, {parsed.year}"


def _contains_unsafe_medical_claim(text: str) -> bool:
    normalized = " ".join(text.lower().split())
    patterns = (
        r"\byou (have|likely have|may have) (an )?(infection|condition|disease|diagnosis)\b",
        r"\bdiagnos(?:e|is|ed)\b",
        r"\b(double|increase|decrease|change) (your )?(dose|medication|medicine)\b",
        r"\b(stop|start|take) (taking )?(your )?(medication|medicine|dose)\b",
        r"\byou should (take|stop|start|change|use)\b",
    )
    return any(re.search(pattern, normalized) for pattern in patterns)
