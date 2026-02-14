"""Shogunate Engine event emitter."""

from datetime import datetime, timezone
from engine.config import supabase


def emit(event_type: str, payload: dict) -> dict:
    """Emit an event to the war_room_events table.

    Args:
        event_type: Type of event (e.g., 'step_completed', 'mission_completed')
        payload: Event data dict

    Returns:
        The created event record, or the event dict if Supabase is unavailable.
    """
    agent_id = (
        payload.get("agent")
        or payload.get("assigned_to")
        or payload.get("daimyo", "system")
    )
    title = payload.get("title", event_type.replace("_", " ").title())
    description = (
        payload.get("message")
        or payload.get("description")
        or payload.get("error", "")
    )

    event = {
        "event_type": event_type,
        "agent_id": agent_id,
        "title": title,
        "description": description,
        "metadata": payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if supabase:
        result = supabase.table("war_room_events").insert(event).execute()
        return result.data[0] if result.data else event

    return event
