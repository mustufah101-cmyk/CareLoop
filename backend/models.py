"""
CareLoop — Pydantic Data Models

Matches the data model defined in GEMINI.md exactly.
Used for API request/response validation and database serialization.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Sub-models ────────────────────────────────────────────────────────────────


class DocumentRecord(BaseModel):
    doc_id: str = Field(default_factory=lambda: str(uuid4()))
    file_name: str
    doc_type: str  # appointment_letter | discharge_summary | generic_handout | etc.
    raw_text: Optional[str] = None  # Stored for reference; never used as generator input
    extracted_json: Optional[dict[str, Any]] = None  # The structured extraction output
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class ChecklistItem(BaseModel):
    item: str
    relative_time: Optional[str] = None
    category: str = "general"
    done: bool = False
    source_field: str = "appointment_letter"  # Every item has a source reference


class Reminder(BaseModel):
    message: str
    trigger_offset_hours: int = -24  # Negative = before appointment (e.g. -24 = 1 day before)
    source_field: str = "appointment_letter"


class SuggestedQuestion(BaseModel):
    question: str
    reason: str = ""
    source_field: str = "appointment_letter"


class BeforeFlowOutput(BaseModel):
    checklist: list[ChecklistItem] = []
    reminders: list[Reminder] = []
    suggested_questions: list[SuggestedQuestion] = []
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class ActionPlanInstruction(BaseModel):
    text: str
    category: str = "general"
    source_field: str = "discharge_summary"  # Non-negotiable


class ActionPlanMilestone(BaseModel):
    milestone: str
    instructions: list[ActionPlanInstruction] = []


class MedicationSummary(BaseModel):
    name: str = ""
    plain_instruction: str = ""
    source_field: str = "discharge_summary"


class FollowUpSummary(BaseModel):
    plain_instruction: str = ""
    timeframe: Optional[str] = None
    source_field: str = "discharge_summary"


class AfterFlowOutput(BaseModel):
    action_plan: list[ActionPlanMilestone] = []
    medications_summary: list[MedicationSummary] = []
    follow_up_summary: list[FollowUpSummary] = []
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class FlaggingCriteria(BaseModel):
    scale_threshold: Optional[int] = None
    text_keywords: list[str] = []
    matched_warning_sign: Optional[str] = None


class ScaleLabels(BaseModel):
    low: str = "No concern"
    high: str = "Very concerned"


class ScheduledCheckin(BaseModel):
    day: int
    prompt_text: str
    response_type: str = "scale_1_5"  # scale_1_5 | yes_no | text
    scale_labels: ScaleLabels = Field(default_factory=ScaleLabels)
    flagging_criteria: FlaggingCriteria = Field(default_factory=FlaggingCriteria)
    source_field: str


class DuringNote(BaseModel):
    note_id: str = Field(default_factory=lambda: str(uuid4()))
    raw_text: Optional[str] = None
    structured_summary: Optional[dict[str, Any]] = None
    captured_at: datetime = Field(default_factory=datetime.utcnow)


class CheckinResponse(BaseModel):
    response_type: str  # scale_1_5 | yes_no | text
    response_value: Any  # int (1-5) | bool | str
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class CheckinRecord(BaseModel):
    checkin_id: str = Field(default_factory=lambda: str(uuid4()))
    scheduled_for_day: int
    prompt_text: str
    response_type: str
    scale_labels: ScaleLabels = Field(default_factory=ScaleLabels)
    flagging_criteria: FlaggingCriteria = Field(default_factory=FlaggingCriteria)
    source_field: str
    response: Optional[CheckinResponse] = None
    flagged: bool = False
    matched_warning_sign: Optional[str] = None
    simulated: bool = False  # True if triggered by "Simulate Day N" demo control


class CareEpisode(BaseModel):
    episode_id: str = Field(default_factory=lambda: str(uuid4()))
    patient_id: str
    appointment_type: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    documents: list[DocumentRecord] = []
    before: Optional[BeforeFlowOutput] = None
    during: list[DuringNote] = []
    after: Optional[AfterFlowOutput] = None
    checkins: list[CheckinRecord] = []


# ── API Request/Response models ────────────────────────────────────────────────


class CreateEpisodeRequest(BaseModel):
    patient_id: str
    appointment_type: Optional[str] = None


class CheckinResponseRequest(BaseModel):
    response_type: str
    response_value: Any


class DuringNoteRequest(BaseModel):
    notes: str  # Patient's free-text notes from the visit


class SimulateDayRequest(BaseModel):
    day: int
    demo_mode: bool = True  # Explicit demo mode flag — never hide this


# —— Copilot grounding models ——


class CopilotIntent(str, Enum):
    DOCUMENT_INSTRUCTION_LOOKUP = "document_instruction_lookup"
    FOLLOW_UP_LOOKUP = "follow_up_lookup"
    VISIT_NOTE_LOOKUP = "visit_note_lookup"
    CARE_HISTORY_LOOKUP = "care_history_lookup"
    WARNING_SIGN_LOOKUP = "warning_sign_lookup"
    CHECKIN_HISTORY_LOOKUP = "checkin_history_lookup"
    UNSUPPORTED_MEDICAL_JUDGMENT = "unsupported_medical_judgment"
    UNKNOWN = "unknown"


class CopilotSourceType(str, Enum):
    CLINICIAN_DOCUMENT = "clinician_document"
    PATIENT_NOTE = "patient_note"
    EPISODE_METADATA = "episode_metadata"
    CHECKIN = "checkin"


class CopilotAuthority(str, Enum):
    CLINICIAN_RECORD = "clinician_record"
    PATIENT_RECORD = "patient_record"
    SYSTEM_METADATA = "system_metadata"
    CHECKIN_RECORD = "checkin_record"


class CopilotAskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: str = Field(min_length=1, max_length=200)
    question: str = Field(min_length=1, max_length=2000)
    episode_ids: Optional[list[str]] = None

    @field_validator("patient_id", "question")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("episode_ids")
    @classmethod
    def validate_episode_ids(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        if len(value) > 100:
            raise ValueError("episode_ids cannot contain more than 100 IDs")
        if any(not episode_id.strip() for episode_id in value):
            raise ValueError("episode_ids must contain non-blank IDs")
        return value


class CopilotEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_id: str = Field(min_length=1)
    source_type: CopilotSourceType
    authority: CopilotAuthority
    episode_id: str = Field(min_length=1)
    document_id: Optional[str] = None
    note_id: Optional[str] = None
    checkin_id: Optional[str] = None
    source_label: str = Field(min_length=1)
    source_field: str = Field(min_length=1)
    evidence_value: Any
    is_verbatim: bool = False
    file_name: Optional[str] = None


class CopilotGroundingResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: CopilotIntent
    supported: bool
    evidence: list[CopilotEvidence] = Field(default_factory=list)
    related_episode_ids: list[str] = Field(default_factory=list)
    medical_judgment_detected: bool = False


class CopilotAnswerType(str, Enum):
    GROUNDED = "grounded"
    UNSUPPORTED = "unsupported"
    NOT_FOUND = "not_found"


class CopilotAnswerSegment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=4000)
    citation_ids: list[str] = Field(default_factory=list)


class CopilotSafety(BaseModel):
    model_config = ConfigDict(extra="forbid")

    medical_judgment_detected: bool
    used_only_recorded_care: bool
    generated_with_llm: bool
    validation_passed: bool


class CopilotAnswerResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str = Field(min_length=1, max_length=12000)
    answer_type: CopilotAnswerType
    supported: bool
    intent: CopilotIntent
    segments: list[CopilotAnswerSegment] = Field(default_factory=list)
    citations: list[CopilotEvidence] = Field(default_factory=list)
    related_episode_ids: list[str] = Field(default_factory=list)
    safety: CopilotSafety
