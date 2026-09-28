"""
CareLoop — Document Extractor

Handles the Extractor LLM role (Role 1):
  - Classifies uploaded documents
  - Extracts structured JSON using vision-capable LLM (no separate OCR step)
  - Enforces the extraction schema per document type

Uses Google Gemini (gemini-2.0-flash) for vision + structured output.
The LLM reads images/PDFs directly — no preprocessing or OCR dependency.
"""

import base64
import json
import os
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from dotenv import load_dotenv

from .extractor_prompts import DOCUMENT_CLASSIFIER_PROMPT, get_extractor_prompt

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


# Supported MIME types for direct vision upload
_MIME_MAP = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jpe": "image/jpeg",
    ".webp": "image/webp",
}

# ── Helpers ───────────────────────────────────────────────────────────────────


def _file_to_part(file_bytes: bytes, filename: str) -> types.Part:
    """Convert file bytes to a Gemini Part for vision input."""
    ext = Path(filename).suffix.lower()
    mime_type = _MIME_MAP.get(ext, "text/plain")

    if mime_type == "text/plain":
        # Plain text — decode and pass as text
        text_content = file_bytes.decode("utf-8", errors="replace")
        return types.Part.from_text(text=text_content)
    else:
        # Binary (PDF/image) — pass as inline data
        return types.Part.from_bytes(data=file_bytes, mime_type=mime_type)


def _parse_json_response(raw: str) -> dict:
    """
    Robustly parse JSON from LLM response.
    Handles markdown code fences that some models add despite instructions.
    """
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        text = "\n".join(lines[1:-1]).strip()
    return json.loads(text)


# ── Core extraction functions ─────────────────────────────────────────────────


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def classify_document(file_bytes: bytes, filename: str) -> dict:
    """
    Classify a document to determine which extraction schema to use.

    Returns:
        dict with keys: document_type, confidence, reasoning
    """
    file_part = _file_to_part(file_bytes, filename)

    raw = await _generate_with_fallback(
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=DOCUMENT_CLASSIFIER_PROMPT),
                    file_part,
                ],
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.1,  # Low temperature — classification should be deterministic
            max_output_tokens=256,
        ),
    )

    result = _parse_json_response(raw)

    # Validate response shape
    if "document_type" not in result:
        raise ValueError(f"Classifier returned unexpected response: {raw[:200]}")

    return result


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def extract_structured(
    file_bytes: bytes,
    filename: str,
    doc_type: str,
) -> dict[str, Any]:
    """
    Extract structured JSON from a document using vision-capable LLM.

    This is the Extractor role (LLM call #1).
    The LLM receives the raw file directly — no separate OCR step.

    Args:
        file_bytes: Raw file bytes (PDF, image, or text)
        filename: Original filename (used to set source_file in output)
        doc_type: Classification result from classify_document()

    Returns:
        Structured dict matching the schema for doc_type
    """
    extraction_prompt = get_extractor_prompt(doc_type, filename)
    file_part = _file_to_part(file_bytes, filename)

    raw = await _generate_with_fallback(
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=extraction_prompt),
                    file_part,
                ],
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.1,  # Extraction must be faithful, not creative
            max_output_tokens=4096,
        ),
    )

    result = _parse_json_response(raw)

    # Safety check: ensure the two non-negotiable fields are present
    if "document_type" not in result or "extraction_confidence" not in result:
        raise ValueError(
            f"Extraction response missing required fields. Raw: {raw[:300]}"
        )

    # If extraction confidence is low, we still return but flag it
    if result.get("extraction_confidence") == "low":
        result["_low_confidence_warning"] = (
            "Extraction confidence is low. The document may be unclear or hard to read. "
            "Consider prompting the patient to re-upload a clearer version."
        )

    return result


async def process_document(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """
    Full document processing pipeline:
      1. Classify document type
      2. Extract structured JSON using the appropriate schema
      3. Return combined result

    This is the entry point called by the API route.
    Raises an error if the document is classified as a non-clinical type.
    """
    # Step 1: Classify
    classification = await classify_document(file_bytes, filename)
    doc_type = classification["document_type"]

    # Step 2: Reject non-clinical documents early
    non_clinical_types = {"billing_statement", "employment_contract", "unknown"}
    if doc_type in non_clinical_types:
        if doc_type == "employment_contract":
            msg = (
                "This document appears to be an employment/job appointment letter or residency contract, "
                "rather than a patient medical appointment letter. CareLoop is designed for patient healthcare episodes."
            )
        elif doc_type == "billing_statement":
            msg = "This document appears to be a billing statement or invoice. Please upload a clinical appointment letter or discharge summary."
        else:
            msg = "We couldn't recognize this as a clinical healthcare document. Please upload an appointment letter, discharge summary, or clinic handout."

        return {
            "error": "wrong_document_type",
            "message": msg,
            "classification": classification,
        }

    # Step 3: Extract
    extracted = await extract_structured(file_bytes, filename, doc_type)

    return {
        "classification": classification,
        "extracted_json": extracted,
        "doc_type": doc_type,
    }
