"""
CareLoop — Pydantic Data Models

Matches the data model defined in GEMINI.md exactly.
Used for API request/response validation and database serialization.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


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
