import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from copilot_grounding import ground_question  # noqa: E402
from main import app  # noqa: E402
from models import (  # noqa: E402
    CareEpisode,
    CheckinRecord,
    DocumentRecord,
    DuringNote,
)


PATIENT_ID = "patient-one"


def document(doc_id, doc_type, extracted):
    return DocumentRecord(
        doc_id=doc_id,
        file_name=f"{doc_id}.pdf",
        doc_type=doc_type,
        extracted_json=extracted,
    )


def episode(episode_id, *, patient_id=PATIENT_ID, appointment_type=None, documents=None, during=None, checkins=None):
    return CareEpisode(
        episode_id=episode_id,
        patient_id=patient_id,
        appointment_type=appointment_type,
        created_at=datetime(2026, 9, 1),
        documents=documents or [],
        during=during or [],
        checkins=checkins or [],
    )


class CopilotGroundingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.records = [episode(
            "episode-one",
            appointment_type="Knee surgery",
            documents=[document("discharge-one", "discharge_summary", {
                "activity_restrictions": [{"restriction": "Do not drive for 7 days"}],
                "follow_up": [{"type": "appointment", "with": "surgeon", "timeframe": "2 weeks"}],
                "warning_signs": ["Increasing redness at the incision"],
            })],
            during=[DuringNote(note_id="note-one", raw_text="I wrote that rest was discussed.")],
            checkins=[CheckinRecord(
                checkin_id="checkin-one",
                scheduled_for_day=3,
                prompt_text="How are you feeling?",
                response_type="scale_1_5",
                source_field="discharge_summary",
            )],
        )]

    def post(self, question, **payload):
        body = {"patient_id": PATIENT_ID, "question": question, **payload}
        with patch("copilot_grounding.database.list_episodes", return_value=self.records):
            return self.client.post("/api/copilot/ground", json=body)

    def test_grounded_document_instruction_query(self):
        response = self.post("What did my instructions say about driving?")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["intent"], "document_instruction_lookup")
        self.assertTrue(data["supported"])
        self.assertEqual(data["evidence"][0]["source_type"], "clinician_document")
        self.assertEqual(data["evidence"][0]["source_field"], "activity_restrictions")

    def test_ask_endpoint_returns_structured_grounded_answer(self):
        body = {"patient_id": PATIENT_ID, "question": "What did my instructions say about driving?"}
        with patch("copilot_grounding.database.list_episodes", return_value=self.records):
            response = self.client.post("/api/copilot/ask", json=body)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["answer_type"], "grounded")
        self.assertIn("Do not drive for 7 days", data["answer"])
        self.assertTrue(data["segments"][0]["citation_ids"])

    def test_follow_up_query(self):
        response = self.post("When should I return for my recorded follow-up?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "follow_up_lookup")
        self.assertTrue(response.json()["supported"])

    def test_visit_note_query(self):
        response = self.post("What did I write down during my last appointment?")
        self.assertEqual(response.status_code, 200)
        evidence = response.json()["evidence"]
        self.assertEqual(response.json()["intent"], "visit_note_lookup")
        self.assertTrue(all(item["source_type"] == "patient_note" for item in evidence))

    def test_warning_sign_query(self):
        response = self.post("What warning signs should I watch for?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "warning_sign_lookup")
        self.assertTrue(response.json()["supported"])

    def test_care_history_query(self):
        self.records.append(episode("episode-two", appointment_type="MRI scan"))
        response = self.post("What care journeys do I have recorded?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "care_history_lookup")
        self.assertEqual(set(response.json()["related_episode_ids"]), {"episode-one", "episode-two"})

    def test_checkin_history_query(self):
        response = self.post("What check-ins are recorded?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["intent"], "checkin_history_lookup")
        self.assertEqual(response.json()["evidence"][0]["checkin_id"], "checkin-one")

    def test_unsupported_medical_judgment_query(self):
        response = self.post("Do I have an infection?")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["intent"], "unsupported_medical_judgment")
        self.assertTrue(data["medical_judgment_detected"])
        self.assertFalse(data["supported"])
        self.assertNotIn("answer", data)

    def test_unknown_no_record_query(self):
        response = self.post("What is my blood type?")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["intent"], "unknown")
        self.assertFalse(data["supported"])
        self.assertEqual(data["evidence"], [])

    def test_empty_question_validation(self):
        response = self.post("")
        self.assertEqual(response.status_code, 422)

    def test_whitespace_question_validation(self):
        response = self.post("   ")
        self.assertEqual(response.status_code, 422)

    def test_oversized_question_validation(self):
        response = self.post("x" * 2001)
        self.assertEqual(response.status_code, 422)

    def test_missing_patient_scope_validation(self):
        response = self.client.post("/api/copilot/ground", json={"question": "What is recorded?"})
        self.assertEqual(response.status_code, 422)

    def test_episode_scope_filtering(self):
        self.records.append(episode("episode-two", appointment_type="MRI scan"))
        response = self.post("What care journeys do I have recorded?", episode_ids=["episode-two"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["related_episode_ids"], ["episode-two"])

    def test_cross_patient_isolation_does_not_reveal_other_episode(self):
        other = episode("other-episode", patient_id="another-patient", appointment_type="Dental appointment")
        response = self.post_with_records("What care journeys do I have recorded?", [other])
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["supported"])
        self.assertEqual(data["evidence"], [])
        self.assertEqual(data["related_episode_ids"], [])

    def test_conflicting_evidence_is_preserved(self):
        self.records[0].documents.extend([
            document("discharge-two", "discharge_summary", {"follow_up": [{"timeframe": "3 weeks"}]}),
        ])
        response = self.post("What follow-up information is recorded?")
        self.assertEqual(response.status_code, 200)
        values = [item["evidence_value"]["timeframe"] for item in response.json()["evidence"]]
        self.assertEqual(values, ["2 weeks", "3 weeks"])

    def test_patient_note_provenance_is_preserved(self):
        response = self.post("What did I write down during my last appointment?")
        self.assertEqual(response.status_code, 200)
        item = response.json()["evidence"][0]
        self.assertEqual(item["source_type"], "patient_note")
        self.assertEqual(item["authority"], "patient_record")

    def test_clinician_document_provenance_is_preserved(self):
        response = self.post("What did my instructions say about driving?")
        self.assertEqual(response.status_code, 200)
        item = response.json()["evidence"][0]
        self.assertEqual(item["source_type"], "clinician_document")
        self.assertEqual(item["authority"], "clinician_record")
        self.assertEqual(item["source_label"], "From your discharge summary")

    def test_malformed_episode_ids_are_rejected(self):
        response = self.post("What is recorded?", episode_ids=[""])
        self.assertEqual(response.status_code, 422)

    def test_server_failure_is_safe(self):
        with patch("routers.copilot.ground_from_storage", side_effect=RuntimeError("database details")):
            response = self.client.post("/api/copilot/ground", json={"patient_id": PATIENT_ID, "question": "What is recorded?"})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "CareLoop could not retrieve your recorded care right now.")
        self.assertNotIn("database details", response.text)

    def post_with_records(self, question, records, **payload):
        body = {"patient_id": PATIENT_ID, "question": question, **payload}
        with patch("copilot_grounding.database.list_episodes", return_value=records):
            return self.client.post("/api/copilot/ground", json=body)


if __name__ == "__main__":
    unittest.main()
