"""
CareLoop — Generator Module

Handles the Generator LLM role (Role 2):
  - Consumes ONLY structured JSON from extraction (never raw document text)
  - Produces patient-facing checklist, action plan, check-in schedule, visit summary
  - Explicitly instructed not to introduce medical facts beyond the input JSON
"""

import json
import os
from typing import Any

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from dotenv import load_dotenv

from .extractor_prompts import (
    AFTER_FLOW_GENERATOR_PROMPT,
    BEFORE_FLOW_GENERATOR_PROMPT,
    CHECKIN_GENERATOR_PROMPT,
    DURING_FLOW_GENERATOR_PROMPT,
)

load_dotenv()

# ── Client setup ─────────────────────────────────────────────────────────────

# Only models that support vision (image/PDF input) - verified available
_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-pro-latest",
]


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable is not set. "
            "Please add GEMINI_API_KEY=your_key to backend/.env"
        )
    return genai.Client(api_key=api_key)


async def _generate_with_fallback(contents, config) -> str:
    client = _get_client()
    last_err = None
    for model in _MODELS:
        try:
            res = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            if res and res.text:
                return res.text
        except Exception as e:
            last_err = e
            continue
    raise last_err or RuntimeError("All models failed")


# ── Helpers ───────────────────────────────────────────────────────────────────


def _parse_json_response(raw: str) -> dict:
    """Parse JSON from LLM response, stripping markdown fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()
    return json.loads(text)


def _json_str(data: dict) -> str:
    """Serialize dict to indented JSON string for prompt injection."""
    return json.dumps(data, indent=2, ensure_ascii=False)


# ── Generator functions ───────────────────────────────────────────────────────


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_before_flow(extracted_json: dict[str, Any]) -> dict[str, Any]:
    """
    Generate Before-flow outputs from an appointment letter extraction.

    Input: structured JSON matching appointment_letter schema
    Output: { checklist, reminders, suggested_questions } — all source-tagged

    This is Generator Role 2 — only sees structured JSON, never raw document.
    """
    prompt = BEFORE_FLOW_GENERATOR_PROMPT.replace(
        "{extracted_json}", _json_str(extracted_json)
    )

    raw = await _generate_with_fallback(
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=types.GenerateContentConfig(
            temperature=0.3,  # Slight creativity OK for phrasing — but stay grounded
            max_output_tokens=4096,
        ),
    )

    result = _parse_json_response(raw)

    # Ensure all checklist items have 'item' and default done=false
    for entry in result.get("checklist", []):
        if "item" not in entry or not entry["item"]:
            entry["item"] = entry.get("label") or entry.get("instruction") or entry.get("text") or entry.get("task") or "Preparation step"
        entry.setdefault("done", False)

    return result


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_after_flow(extracted_json: dict[str, Any]) -> dict[str, Any]:
    """
    Generate After-flow action plan from a discharge summary extraction.

    Input: structured JSON matching discharge_summary schema
    Output: { action_plan, medications_summary, follow_up_summary } — all source-tagged

    This is Generator Role 2 — only sees structured JSON, never raw document.
    """
    prompt = AFTER_FLOW_GENERATOR_PROMPT.replace(
        "{extracted_json}", _json_str(extracted_json)
    )

    raw = await _generate_with_fallback(
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=4096,
        ),
    )

    result = _parse_json_response(raw)

    for entry in result.get("action_plan", []):
        if "item" not in entry or not entry["item"]:
            entry["item"] = entry.get("instruction") or entry.get("label") or entry.get("text") or entry.get("task") or "Care instruction"
        entry.setdefault("done", False)

    return result


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_checkin_schedule(extracted_json: dict[str, Any]) -> dict[str, Any]:
    """
    Derive check-in schedule and questions from a discharge summary extraction.

    Input: structured JSON matching discharge_summary schema
    Output: { checkin_schedule } — flagging criteria derived ONLY from warning_signs in input

    This is Generator Role 2.
    """
    prompt = CHECKIN_GENERATOR_PROMPT.replace(
        "{extracted_json}", _json_str(extracted_json)
    )

    raw = await _generate_with_fallback(
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=types.GenerateContentConfig(
            temperature=0.2,  # Check-in generation should be very faithful to source
            max_output_tokens=3000,
        ),
    )

    return _parse_json_response(raw)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_during_flow(patient_notes: str) -> dict[str, Any]:
    """
    Structure patient's visit notes into a visit summary.

    Input: patient's free-text notes from the appointment
    Output: { visit_summary: { summary, action_items, general_info } }

    Note: this generator receives patient notes directly (not extracted JSON),
    since during-flow has no upstream extraction step. The notes are the source.
    """
    prompt = DURING_FLOW_GENERATOR_PROMPT.replace("{patient_notes}", patient_notes)

    raw = await _generate_with_fallback(
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=2000,
        ),
    )

    return _parse_json_response(raw)

