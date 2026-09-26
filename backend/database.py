"""
CareLoop — SQLite Database Layer

Simple JSON-in-SQLite storage pattern for the hackathon.
Stores each CareEpisode as a JSON blob keyed by episode_id.
Fast to iterate, easy to inspect, no ORM overhead.
"""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from models import CareEpisode

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "careloop.db"


# ── Connection context manager ────────────────────────────────────────────────


@contextmanager
def get_db():
    """Yield a SQLite connection with row_factory set for dict-style access."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
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
