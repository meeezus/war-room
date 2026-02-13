"""Shogunate Engine relationship and affinity system.

Queries agent_relationships table for affinity scores between Daimyo agents.
Used for collaborative step assignment and post-mission drift.
"""

from datetime import datetime, timezone
from engine.config import supabase


def get_affinity(agent_a: str, agent_b: str) -> float:
    """Get affinity score between two agents.

    Args:
        agent_a: First agent ID (e.g., 'ed')
        agent_b: Second agent ID (e.g., 'light')

    Returns:
        Affinity score (0.0-1.0), defaults to 0.5 if no relationship found
    """
    if not supabase or agent_a == agent_b:
        return 1.0 if agent_a == agent_b else 0.5

    try:
        # Check both directions
        result = (
            supabase.table("agent_relationships")
            .select("affinity")
            .eq("agent_a", agent_a)
            .eq("agent_b", agent_b)
            .limit(1)
            .execute()
        )

        if result.data:
            return result.data[0]["affinity"]

        # Try reverse direction
        result = (
            supabase.table("agent_relationships")
            .select("affinity")
            .eq("agent_a", agent_b)
            .eq("agent_b", agent_a)
            .limit(1)
            .execute()
        )

        if result.data:
            return result.data[0]["affinity"]

    except Exception:
        pass

    return 0.5  # Default affinity


def get_best_collaborator(primary_agent: str, candidates: list[str]) -> str:
    """Pick the candidate with highest affinity to the primary agent.

    Args:
        primary_agent: The main assigned agent
        candidates: List of agent IDs to choose from

    Returns:
        The agent ID with highest affinity, or first candidate if tie/error
    """
    if not candidates:
        return primary_agent

    best_agent = candidates[0]
    best_score = -1.0

    for candidate in candidates:
        score = get_affinity(primary_agent, candidate)
        if score > best_score:
            best_score = score
            best_agent = candidate

    return best_agent


def apply_drift(agent_pairs: list[tuple[str, str]], success: bool) -> list[dict]:
    """Apply affinity drift after mission completion.

    On success: +0.03 (capped at 0.95)
    On failure: -0.02 (floored at 0.10)

    Args:
        agent_pairs: List of (agent_a, agent_b) tuples who collaborated
        success: Whether the mission succeeded

    Returns:
        List of updated relationship dicts
    """
    if not supabase:
        return []

    delta = 0.03 if success else -0.02
    now = datetime.now(timezone.utc).isoformat()
    updated = []

    for agent_a, agent_b in agent_pairs:
        if agent_a == agent_b:
            continue

        # Normalize order for consistency
        a, b = sorted([agent_a, agent_b])

        try:
            # Get current relationship
            result = (
                supabase.table("agent_relationships")
                .select("*")
                .eq("agent_a", a)
                .eq("agent_b", b)
                .limit(1)
                .execute()
            )

            if not result.data:
                # Try reverse
                result = (
                    supabase.table("agent_relationships")
                    .select("*")
                    .eq("agent_a", b)
                    .eq("agent_b", a)
                    .limit(1)
                    .execute()
                )

            if not result.data:
                continue

            rel = result.data[0]
            old_affinity = rel.get("affinity", 0.5)
            new_affinity = max(0.10, min(0.95, old_affinity + delta))

            # Build drift history entry
            drift_entry = {
                "timestamp": now,
                "delta": delta,
                "old": old_affinity,
                "new": new_affinity,
                "reason": "mission_success" if success else "mission_failure",
            }

            drift_history = rel.get("drift_history", []) or []
            drift_history.append(drift_entry)

            # Update
            update_result = (
                supabase.table("agent_relationships")
                .update({
                    "affinity": new_affinity,
                    "drift_history": drift_history,
                })
                .eq("id", rel["id"])
                .execute()
            )

            if update_result.data:
                updated.append(update_result.data[0])

        except Exception:
            continue

    return updated
