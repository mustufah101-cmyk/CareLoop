"""Deterministic grounding for the future CareLoop Copilot.

This module deliberately does not call an LLM. It classifies a question into
one closed intent set and returns only whitelisted values already stored on
the patient's CareEpisode records.
"""

import re
from collections.abc import Iterable
from datetime import datetime
from typing import Any

import database
from models import (
    CareEpisode,
    CopilotAskRequest,
    CopilotAuthority,
    CopilotEvidence,
    CopilotGroundingResult,
    CopilotIntent,
    CopilotSourceType,
)


_STOP_WORDS = {
    "a", "about", "am", "an", "and", "are", "can", "did", "do", "for",
    "how", "i", "in", "is", "it", "my", "of", "on", "should", "the",
    "to", "what", "when", "where", "which", "with", "you", "your",
}

_MEDICAL_JUDGMENT_PATTERNS = (
    r"\bdo i have\b.*\b(infection|condition|disease|symptom|illness)\b",
    r"\bshould i\b.*\b(take|stop|start|change|double|use|treatment|medication|medicine|dose)\b",
    r"\bcan i stop\b",
    r"\bwhat treatment\b",
    r"\bwhat dose\b",
    r"\bhow much .*\b(take|medication|medicine)\b",
    r"\bdouble (my )?(dose|medication|medicine)\b",
    r"\b(is|are) .*\bdangerous\b",
    r"\bdiagnos(?:e|is|ed)\b",
    r"\bprognosis\b",
    r"\bwill i recover\b",
)


def classify_copilot_intent(question: str) -> CopilotIntent:
    """Classify a question without an LLM or open-ended intent generation."""
    normalized = " ".join(question.lower().split())

    # Explicit record-lookup wording takes precedence over medical judgment
    # wording so questions such as "Was infection mentioned in my records?"
    # can remain a grounded lookup rather than becoming a diagnosis request.
    record_lookup = any(
        phrase in normalized
        for phrase in ("in my records", "in my care", "did my", "does my")
    )
    if not record_lookup and any(re.search(pattern, normalized) for pattern in _MEDICAL_JUDGMENT_PATTERNS):
        return CopilotIntent.UNSUPPORTED_MEDICAL_JUDGMENT

    if any(term in normalized for term in ("visit note", "visit notes", "what i wrote", "write down", "my notes", "appointment notes", "during my appointment", "during my last appointment", "last recorded visit", "what happened during my last visit")):
        return CopilotIntent.VISIT_NOTE_LOOKUP
    if any(term in normalized for term in ("follow-up", "follow up", "return", "come back", "next visit")):
        return CopilotIntent.FOLLOW_UP_LOOKUP
    if any(term in normalized for term in ("warning sign", "warning signs", "red flag", "watch for", "what should i watch")):
        return CopilotIntent.WARNING_SIGN_LOOKUP
    if any(term in normalized for term in ("check-in", "check in", "checkin", "flagged", "responded", "day ")):
        return CopilotIntent.CHECKIN_HISTORY_LOOKUP
    if any(term in normalized for term in ("care instruction", "instructions", "driving", "bring", "preparation", "restriction", "medication")):
        return CopilotIntent.DOCUMENT_INSTRUCTION_LOOKUP
    if any(term in normalized for term in ("care journey", "care journeys", "episodes", "recorded care", "care history", "visits")):
        return CopilotIntent.CARE_HISTORY_LOOKUP

    return CopilotIntent.UNKNOWN


def ground_from_storage(request: CopilotAskRequest) -> CopilotGroundingResult:
    """Load only the requested patient's episodes, then ground the question."""
    return ground_question(request, database.list_episodes(request.patient_id))


def ground_question(
    request: CopilotAskRequest,
    episodes: Iterable[CareEpisode],
) -> CopilotGroundingResult:
    """Return deterministic, provenance-preserving evidence for a question.

    The supplied episode collection is still filtered by patient ID and the
    optional episode scope. Stored strings are handled only as data; no text
    from a document or patient note is interpreted as control instructions.
    """
    intent = classify_copilot_intent(request.question)
    patient_episodes = [episode for episode in episodes if episode.patient_id == request.patient_id]
    if request.episode_ids is not None:
        allowed_ids = set(request.episode_ids)
        patient_episodes = [episode for episode in patient_episodes if episode.episode_id in allowed_ids]

    evidence: list[CopilotEvidence] = []
    if intent == CopilotIntent.DOCUMENT_INSTRUCTION_LOOKUP:
        evidence.extend(_document_instruction_evidence(patient_episodes))
    elif intent == CopilotIntent.FOLLOW_UP_LOOKUP:
        evidence.extend(_follow_up_evidence(patient_episodes))
    elif intent == CopilotIntent.VISIT_NOTE_LOOKUP:
        evidence.extend(_visit_note_evidence(patient_episodes))
    elif intent == CopilotIntent.CARE_HISTORY_LOOKUP:
        evidence.extend(_care_history_evidence(patient_episodes))
    elif intent == CopilotIntent.WARNING_SIGN_LOOKUP:
        evidence.extend(_warning_sign_evidence(patient_episodes))
    elif intent == CopilotIntent.CHECKIN_HISTORY_LOOKUP:
        evidence.extend(_checkin_evidence(patient_episodes))
    elif intent == CopilotIntent.UNSUPPORTED_MEDICAL_JUDGMENT:
        evidence.extend(_related_warning_sign_evidence(patient_episodes, request.question))

    related_episode_ids = _unique_episode_ids(evidence)
    return CopilotGroundingResult(
        intent=intent,
        supported=bool(evidence) and intent != CopilotIntent.UNSUPPORTED_MEDICAL_JUDGMENT,
        evidence=evidence,
        related_episode_ids=related_episode_ids,
        medical_judgment_detected=intent == CopilotIntent.UNSUPPORTED_MEDICAL_JUDGMENT,
    )


def _document_instruction_evidence(episodes: Iterable[CareEpisode]) -> list[CopilotEvidence]:
    allowed_fields = (
        "preparation_requirements",
        "activity_restrictions",
        "medications",
        "medication_holds",
        "items_to_bring",
        "action_items",
    )
    result: list[CopilotEvidence] = []
    for episode in episodes:
        for document in episode.documents:
            extracted = document.extracted_json or {}
            for field in allowed_fields:
                result.extend(_document_field_evidence(episode, document, field, extracted.get(field)))
    return result


def _follow_up_evidence(episodes: Iterable[CareEpisode]) -> list[CopilotEvidence]:
    result: list[CopilotEvidence] = []
    for episode in episodes:
        for document in episode.documents:
            extracted = document.extracted_json or {}
            result.extend(_document_field_evidence(episode, document, "follow_up", extracted.get("follow_up")))
        for follow_up in (episode.after.follow_up_summary if episode.after else []):
            result.append(_evidence(
                evidence_id=f"{episode.episode_id}:after:follow_up_summary:{len(result)}",
                source_type=CopilotSourceType.CLINICIAN_DOCUMENT,
                authority=CopilotAuthority.CLINICIAN_RECORD,
                episode_id=episode.episode_id,
                source_label="From your recorded follow-up information",
                source_field="after.follow_up_summary",
                evidence_value=follow_up.model_dump(mode="json"),
                is_verbatim=False,
            ))
    return result


def _visit_note_evidence(episodes: Iterable[CareEpisode]) -> list[CopilotEvidence]:
    result: list[CopilotEvidence] = []
    for episode in episodes:
        for note in episode.during:
            if note.raw_text:
                result.append(_evidence(
                    evidence_id=f"{episode.episode_id}:note:{note.note_id}:raw_text",
                    source_type=CopilotSourceType.PATIENT_NOTE,
                    authority=CopilotAuthority.PATIENT_RECORD,
                    episode_id=episode.episode_id,
                    note_id=note.note_id,
                    source_label="From your visit notes",
                    source_field="during.raw_text",
                    evidence_value=note.raw_text,
                    is_verbatim=True,
                ))
            if note.structured_summary:
                result.append(_evidence(
                    evidence_id=f"{episode.episode_id}:note:{note.note_id}:structured_summary",
                    source_type=CopilotSourceType.PATIENT_NOTE,
                    authority=CopilotAuthority.PATIENT_RECORD,
                    episode_id=episode.episode_id,
                    note_id=note.note_id,
                    source_label="From the summary of your visit notes",
                    source_field="during.structured_summary",
                    evidence_value=note.structured_summary,
                    is_verbatim=False,
                ))
    return result


def _care_history_evidence(episodes: Iterable[CareEpisode]) -> list[CopilotEvidence]:
    result: list[CopilotEvidence] = []
    for episode in episodes:
        if episode.appointment_type:
            result.append(_evidence(
                evidence_id=f"{episode.episode_id}:metadata:appointment_type",
                source_type=CopilotSourceType.EPISODE_METADATA,
                authority=CopilotAuthority.SYSTEM_METADATA,
                episode_id=episode.episode_id,
                source_label="From your recorded care journey",
                source_field="appointment_type",
                evidence_value=episode.appointment_type,
                is_verbatim=False,
            ))
        result.append(_evidence(
            evidence_id=f"{episode.episode_id}:metadata:created_at",
            source_type=CopilotSourceType.EPISODE_METADATA,
            authority=CopilotAuthority.SYSTEM_METADATA,
            episode_id=episode.episode_id,
            source_label="From your recorded care journey",
            source_field="created_at",
            evidence_value=_serialize_value(episode.created_at),
            is_verbatim=False,
        ))
    return result


def _warning_sign_evidence(episodes: Iterable[CareEpisode]) -> list[CopilotEvidence]:
    result: list[CopilotEvidence] = []
    for episode in episodes:
        for document in episode.documents:
            extracted = document.extracted_json or {}
            result.extend(_document_field_evidence(episode, document, "warning_signs", extracted.get("warning_signs")))
    return result


def _related_warning_sign_evidence(episodes: Iterable[CareEpisode], question: str) -> list[CopilotEvidence]:
    question_tokens = _meaningful_tokens(question)
    return [
        item
        for item in _warning_sign_evidence(episodes)
        if question_tokens & _meaningful_tokens(str(item.evidence_value))
    ]


def _checkin_evidence(episodes: Iterable[CareEpisode]) -> list[CopilotEvidence]:
    result: list[CopilotEvidence] = []
    for episode in episodes:
        for checkin in episode.checkins:
            result.append(_evidence(
                evidence_id=f"{episode.episode_id}:checkin:{checkin.checkin_id}",
                source_type=CopilotSourceType.CHECKIN,
                authority=CopilotAuthority.CHECKIN_RECORD,
                episode_id=episode.episode_id,
                checkin_id=checkin.checkin_id,
                source_label="From your recorded check-in",
                source_field="checkins",
                evidence_value=checkin.model_dump(mode="json"),
                is_verbatim=False,
            ))
    return result


def _document_field_evidence(episode, document, field: str, value: Any) -> list[CopilotEvidence]:
    if value is None or value == [] or value == "":
        return []
    label = _document_label(document.doc_type)
    if isinstance(value, list):
        return [
            _evidence(
                evidence_id=f"{episode.episode_id}:document:{document.doc_id}:{field}:{index}",
                source_type=CopilotSourceType.CLINICIAN_DOCUMENT,
                authority=CopilotAuthority.CLINICIAN_RECORD,
                episode_id=episode.episode_id,
                document_id=document.doc_id,
                source_label=label,
                source_field=field,
                evidence_value=item,
                is_verbatim=False,
                file_name=document.file_name,
            )
            for index, item in enumerate(value)
        ]
    return [_evidence(
        evidence_id=f"{episode.episode_id}:document:{document.doc_id}:{field}",
        source_type=CopilotSourceType.CLINICIAN_DOCUMENT,
        authority=CopilotAuthority.CLINICIAN_RECORD,
        episode_id=episode.episode_id,
        document_id=document.doc_id,
        source_label=label,
        source_field=field,
        evidence_value=value,
        is_verbatim=False,
        file_name=document.file_name,
    )]


def _evidence(*, evidence_id: str, source_type: CopilotSourceType, authority: CopilotAuthority, episode_id: str, source_label: str, source_field: str, evidence_value: Any, is_verbatim: bool, document_id: str | None = None, note_id: str | None = None, checkin_id: str | None = None, file_name: str | None = None) -> CopilotEvidence:
    return CopilotEvidence(
        evidence_id=evidence_id,
        source_type=source_type,
        authority=authority,
        episode_id=episode_id,
        document_id=document_id,
        note_id=note_id,
        checkin_id=checkin_id,
        source_label=source_label,
        source_field=source_field,
        evidence_value=evidence_value,
        is_verbatim=is_verbatim,
        file_name=file_name,
    )


def _document_label(doc_type: str) -> str:
    labels = {
        "appointment_letter": "From your appointment letter",
        "discharge_summary": "From your discharge summary",
        "generic_handout": "From your care handout",
        "referral_letter": "From your referral letter",
        "prescription": "From your prescription document",
    }
    return labels.get(doc_type, "From your recorded care document")


def _meaningful_tokens(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if token not in _STOP_WORDS}


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _unique_episode_ids(evidence: Iterable[CopilotEvidence]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in evidence:
        if item.episode_id not in seen:
            seen.add(item.episode_id)
            result.append(item.episode_id)
    return result
