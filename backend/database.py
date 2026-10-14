"""
CareLoop — SQLite Database Layer

Simple JSON-in-SQLite storage pattern for the hackathon.
Stores each CareEpisode as a JSON blob keyed by episode_id.
Fast to iterate, easy to inspect, no ORM overhead.
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from models import CareEpisode

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "careloop.db"


# ── Connection context manager ────────────────────────────────────────────────


@contextmanager
def get_db():
    """Yield a SQLite connection with row_factory set for dict-style access."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Schema initialization ─────────────────────────────────────────────────────


def init_db():
    """Create tables if they don't exist. Safe to call on every startup."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS episodes (
                episode_id  TEXT PRIMARY KEY,
                patient_id  TEXT NOT NULL,
                data        TEXT NOT NULL,  -- Full CareEpisode JSON blob
                created_at  TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_episodes_patient
            ON episodes(patient_id)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS copilot_conversations (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                title       TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user
            ON copilot_conversations(user_id, updated_at DESC)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS copilot_messages (
                id              TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                text            TEXT NOT NULL,
                answer_type     TEXT,
                intent          TEXT,
                metadata        TEXT,
                created_at      TEXT NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES copilot_conversations(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_copilot_messages_conversation
            ON copilot_messages(conversation_id, created_at)
        """)


# ── CRUD operations ───────────────────────────────────────────────────────────


def save_episode(episode: CareEpisode) -> None:
    """Insert or replace an episode (upsert)."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO episodes (episode_id, patient_id, data, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                episode.episode_id,
                episode.patient_id,
                episode.model_dump_json(),
                episode.created_at.isoformat(),
            ),
        )


def get_episode(episode_id: str) -> Optional[CareEpisode]:
    """Fetch an episode by ID. Returns None if not found."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT data FROM episodes WHERE episode_id = ?", (episode_id,)
        ).fetchone()

    if row is None:
        return None

    return CareEpisode.model_validate_json(row["data"])


def list_episodes(patient_id: str) -> list[CareEpisode]:
    """List all episodes for a patient, newest first."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT data FROM episodes WHERE patient_id = ? ORDER BY created_at DESC",
            (patient_id,),
        ).fetchall()

    return [CareEpisode.model_validate_json(row["data"]) for row in rows]


def delete_episode(episode_id: str) -> bool:
    """Delete an episode. Returns True if deleted, False if not found."""
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM episodes WHERE episode_id = ?", (episode_id,)
        )
    return cursor.rowcount > 0


# ── Authenticated Copilot conversation storage ─────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_copilot_conversation(title: str = "New conversation", user_id: str = "local-demo") -> dict:
    init_db()
    conversation_id = str(uuid4())
    timestamp = _now_iso()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO copilot_conversations (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (conversation_id, user_id, title, timestamp, timestamp),
        )
    return {
        "id": conversation_id,
        "title": title,
        "created_at": timestamp,
        "updated_at": timestamp,
        "message_count": 0,
        "messages": [],
    }


def list_copilot_conversations() -> list[dict]:
    init_db()
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.title, c.created_at, c.updated_at,
                   COUNT(m.id) AS message_count
            FROM copilot_conversations c
            LEFT JOIN copilot_messages m ON m.conversation_id = c.id
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            """,
        ).fetchall()
    return [dict(row) for row in rows]


def get_copilot_conversation(conversation_id: str) -> Optional[dict]:
    init_db()
    with get_db() as conn:
        conversation = conn.execute(
            """
            SELECT id, user_id, title, created_at, updated_at
            FROM copilot_conversations
            WHERE id = ?
            """,
            (conversation_id,),
        ).fetchone()
        if conversation is None:
            return None
        messages = conn.execute(
            """
            SELECT id, role, text, answer_type, intent, metadata, created_at
            FROM copilot_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC, rowid ASC
            """,
            (conversation_id,),
        ).fetchall()

    result = dict(conversation)
    result.pop("user_id", None)
    result["message_count"] = len(messages)
    result["messages"] = []
    for message in messages:
        item = dict(message)
        metadata = json.loads(item.pop("metadata") or "null")
        item["response"] = metadata if item["role"] == "assistant" else None
        item.pop("answer_type", None)
        item.pop("intent", None)
        result["messages"].append(item)
    return result


def append_copilot_message(
    conversation_id: str,
    *,
    role: str,
    text: str,
    response: Optional[dict] = None,
) -> bool:
    init_db()
    timestamp = _now_iso()
    metadata = json.dumps(response, ensure_ascii=False) if response is not None else None
    answer_type = response.get("answer_type") if response else None
    intent = response.get("intent") if response else None
    with get_db() as conn:
        owner = conn.execute(
            "SELECT 1 FROM copilot_conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()
        if owner is None:
            return False
        conn.execute(
            """
            INSERT INTO copilot_messages
                (id, conversation_id, role, text, answer_type, intent, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid4()), conversation_id, role, text, answer_type, intent, metadata, timestamp),
        )
        conn.execute(
            "UPDATE copilot_conversations SET updated_at = ? WHERE id = ?",
            (timestamp, conversation_id),
        )
    return True


def update_copilot_title(conversation_id: str, title: str) -> bool:
    init_db()
    with get_db() as conn:
        cursor = conn.execute(
            """
            UPDATE copilot_conversations
            SET title = ?
            WHERE id = ?
            """,
            (title, conversation_id),
        )
    return cursor.rowcount > 0


def delete_copilot_conversation(conversation_id: str) -> bool:
    init_db()
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM copilot_conversations WHERE id = ?",
            (conversation_id,),
        )
    return cursor.rowcount > 0
