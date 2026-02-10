"""Shogunate Engine event emitter."""

from datetime import datetime, timezone
from engine.config import supabase


def emit(event_type: str, payload: dict) -> dict:
    """Emit an event to the ops_agent_events table.

    Args:
        event_type: Type of event (e.g., 'step_completed', 'mission_completed')
        payload: Event data dict

    Returns:
        The created event record, or the payload if Supabase is unavailable.
    """
    event = {
        "event_type": event_type,
        "payload": payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if supabase:
        result = supabase.table("ops_agent_events").insert(event).execute()
        return result.data[0] if result.data else event

    return event
