from models import DuringNote, DuringNoteRequest, SuggestedQuestion


def test_prepared_question_id_is_stable_across_model_round_trip():
    question = SuggestedQuestion(question="When can I drive again?")
    restored = SuggestedQuestion.model_validate_json(question.model_dump_json())

    assert question.question_id == restored.question_id
    assert question.question_id.startswith("question-")


def test_question_specific_during_note_preserves_patient_note_reference():
    question = SuggestedQuestion(question="When should I follow up?")
    request = DuringNoteRequest(
        notes="I recorded that follow-up was discussed.",
        question_id=question.question_id,
        question_text=question.question,
    )
    note = DuringNote(
        raw_text=request.notes,
        question_id=request.question_id,
        question_text=request.question_text,
    )

    assert note.raw_text == "I recorded that follow-up was discussed."
    assert note.question_id == question.question_id
    assert note.question_text == question.question


def test_question_reference_fields_must_be_provided_together():
    try:
        DuringNoteRequest(notes="A note", question_id="question-123")
    except ValueError as error:
        assert "provided together" in str(error)
    else:
        raise AssertionError("Expected question reference validation to fail")
