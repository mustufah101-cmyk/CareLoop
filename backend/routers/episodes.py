"""
CareLoop — Episodes Router

Handles:
  POST /api/episodes              — create new care episode
  GET  /api/episodes/{id}         — get full episode state
  GET  /api/episodes              — list episodes for a patient
  DELETE /api/episodes/{id}       — delete an episode
"""

from fastapi import APIRouter, HTTPException, Query

import database
from models import CareEpisode, CreateEpisodeRequest

router = APIRouter(prefix="/api/episodes", tags=["episodes"])


@router.post("", response_model=CareEpisode, status_code=201)
async def create_episode(body: CreateEpisodeRequest):
    """Create a new care episode for a patient."""
    episode = CareEpisode(
        patient_id=body.patient_id,
        appointment_type=body.appointment_type,
    )
    database.save_episode(episode)
    return episode


@router.get("", response_model=list[CareEpisode])
async def list_episodes(patient_id: str = Query(..., description="Patient ID")):
    """List all episodes for a patient."""
    return database.list_episodes(patient_id)


@router.get("/{episode_id}", response_model=CareEpisode)
async def get_episode(episode_id: str):
    """Get a single episode by ID."""
    episode = database.get_episode(episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode


@router.delete("/{episode_id}", status_code=204)
async def delete_episode(episode_id: str):
    """Delete an episode."""
    deleted = database.delete_episode(episode_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Episode not found")
