import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
from main import app  # noqa: E402
from models import CareEpisode, DocumentRecord  # noqa: E402
from copilot_answers import CopilotSynthesisError  # noqa: E402


class CopilotConversationApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = database.DB_PATH
        database.DB_PATH = Path(self.temp_dir.name) / "test.db"
        database.init_db()

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_local_user_creates_and_lists_conversation(self):
        response = self.client.post("/api/copilot/conversations", json={})
        self.assertEqual(response.status_code, 201)
        conversation_id = response.json()["id"]

        listed = self.client.get("/api/copilot/conversations")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()[0]["id"], conversation_id)

    def test_legacy_auth_owned_conversation_remains_available_locally(self):
        conversation = database.create_copilot_conversation("Legacy chat", user_id="another-user")
        conversation_id = conversation["id"]

        fetched = self.client.get(f"/api/copilot/conversations/{conversation_id}")
        deleted = self.client.delete(f"/api/copilot/conversations/{conversation_id}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get("/api/copilot/conversations").json(), [])

    def test_local_user_can_continue_any_local_conversation(self):
        conversation = database.create_copilot_conversation("Legacy chat", user_id="another-user")
        response = self.client.post(
            "/api/copilot/ask",
            json={
                "patient_id": "patient-one",
                "question": "What is recorded?",
                "conversation_id": conversation["id"],
            },
        )
        self.assertEqual(response.status_code, 200)

    def test_first_ask_creates_title_and_persists_user_and_assistant(self):
        with patch("copilot_grounding.database.list_episodes", return_value=[]):
            response = self.client.post(
                "/api/copilot/ask",
                json={"patient_id": "patient-one", "question": "What warning signs were listed?"},
            )
        self.assertEqual(response.status_code, 200)
        conversation_id = response.json()["conversation_id"]
        detail = self.client.get(f"/api/copilot/conversations/{conversation_id}").json()
        self.assertEqual(detail["title"], "Warning signs")
        self.assertEqual([message["role"] for message in detail["messages"]], ["user", "assistant"])
        self.assertEqual(detail["messages"][0]["text"], "What warning signs were listed?")
        self.assertEqual(detail["messages"][1]["response"]["conversation_id"], conversation_id)

    def test_assistant_citations_and_provenance_reopen_with_conversation(self):
        episode = CareEpisode(
            episode_id="episode-one",
            patient_id="patient-one",
            documents=[DocumentRecord(
                doc_id="doc-one",
                file_name="instructions.pdf",
                doc_type="discharge_summary",
                extracted_json={"activity_restrictions": [{"restriction": "Do not drive for 7 days"}]},
            )],
        )
        with patch("copilot_grounding.database.list_episodes", return_value=[episode]):
            response = self.client.post(
                "/api/copilot/ask",
                json={"patient_id": "patient-one", "question": "What did my instructions say about driving?"},
            )
        conversation_id = response.json()["conversation_id"]
        reopened = self.client.get(f"/api/copilot/conversations/{conversation_id}").json()
        saved_response = reopened["messages"][1]["response"]
        self.assertEqual(saved_response["citations"][0]["source_type"], "clinician_document")
        self.assertEqual(saved_response["citations"][0]["file_name"], "instructions.pdf")

    def test_failed_copilot_call_keeps_user_message_without_fake_assistant(self):
        with patch("copilot_grounding.database.list_episodes", return_value=[]), patch(
            "routers.copilot.answer_copilot_question",
            new=AsyncMock(side_effect=CopilotSynthesisError("provider unavailable")),
        ):
            response = self.client.post(
                "/api/copilot/ask",
                json={"patient_id": "patient-one", "question": "Summarize my recorded care"},
            )
        self.assertEqual(response.status_code, 503)
        conversation_id = self.client.get("/api/copilot/conversations").json()[0]["id"]
        messages = self.client.get(f"/api/copilot/conversations/{conversation_id}").json()["messages"]
        self.assertEqual([message["role"] for message in messages], ["user"])

    def test_old_assistant_text_is_not_used_as_grounding_evidence(self):
        conversation = database.create_copilot_conversation("Earlier question", user_id="user-one")
        database.append_copilot_message(
            conversation["id"], role="assistant", text="You have an infection.",
            response={"answer": "You have an infection."},
        )
        with patch("copilot_grounding.database.list_episodes", return_value=[]):
            response = self.client.post(
                "/api/copilot/ask",
                json={
                    "patient_id": "patient-one",
                    "question": "What is my blood type?",
                    "conversation_id": conversation["id"],
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("could not find", response.json()["answer"].lower())
        self.assertNotIn("infection", response.json()["answer"].lower())

    def test_deleting_chat_does_not_delete_episode_data(self):
        episode = CareEpisode(episode_id="episode-one", patient_id="patient-one")
        database.save_episode(episode)
        conversation = database.create_copilot_conversation()
        response = self.client.delete(f"/api/copilot/conversations/{conversation['id']}")
        self.assertEqual(response.status_code, 204)
        self.assertIsNotNone(database.get_episode("episode-one"))


if __name__ == "__main__":
    unittest.main()
