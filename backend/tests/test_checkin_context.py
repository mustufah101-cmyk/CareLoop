import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from models import CheckinRecord, CheckinResponseRequest, FlaggingCriteria
from routers.checkins import _evaluate_flag


def checkin(criteria=None):
    return CheckinRecord(
        scheduled_for_day=3,
        prompt_text="How is it today?",
        response_type="text",
        source_field="warning_signs[0]",
        flagging_criteria=criteria or FlaggingCriteria(),
    )


def test_warning_sign_derived_checkin_flags_only_matching_recorded_keyword():
    record = checkin(FlaggingCriteria(text_keywords=["increasing redness"], matched_warning_sign="Increasing redness"))

    flagged, matched = _evaluate_flag(
        record,
        CheckinResponseRequest(response_type="text", response_value="I notice increasing redness"),
    )

    assert flagged is True
    assert matched == "Increasing redness"


def test_non_flagged_response_has_no_reassurance_or_medical_interpretation():
    record = checkin(FlaggingCriteria(text_keywords=["increasing redness"], matched_warning_sign="Increasing redness"))

    flagged, matched = _evaluate_flag(
        record,
        CheckinResponseRequest(response_type="text", response_value="No change"),
    )

    assert flagged is False
    assert matched is None


def test_missing_source_context_does_not_create_a_flag():
    record = CheckinRecord(
        scheduled_for_day=1,
        prompt_text="How are you feeling?",
        response_type="text",
        source_field="checkins",
    )

    flagged, matched = _evaluate_flag(
        record,
        CheckinResponseRequest(response_type="text", response_value="I feel unwell"),
    )

    assert flagged is False
    assert matched is None
