"""Shogunate Engine proposal service.

CRUD operations for proposals in Supabase.
"""

from datetime import datetime, timezone
from engine.config import supabase
from engine.events import emit


def create_proposal(
    title: str,
    description: str,
    domain: str = "engineering",
    requested_by: str = "Sensei",
    project_id: str | None = None,
    source: str = "manual",
) -> dict:
    """Create a proposal in Supabase.

    Args:
        title: Proposal title
        description: What needs to be done
        domain: Domain (engineering, product, commerce, influence, operations)
        requested_by: Who requested this
        project_id: Optional project UUID to link to
        source: Origin (manual, discord, cron, trigger)

    Returns:
        The created proposal dict

    Raises:
        RuntimeError: If Supabase client not initialized
    """
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    proposal_data = {
        "title": title,
        "description": description,
        "domain": domain,
        "requested_by": requested_by,
        "project_id": project_id,
        "source": source,
        "status": "pending",
    }

    result = supabase.table("proposals").insert(proposal_data).execute()
    proposal = result.data[0]

    emit("proposal_created", {
        "proposal_id": proposal["id"],
        "title": title,
        "domain": domain,
        "requested_by": requested_by,
        "agent": "system",
    })

    return proposal


def list_pending() -> list[dict]:
    """Return all proposals with status='pending'.

    Returns:
        List of pending proposal dicts, ordered by created_at
    """
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    result = (
        supabase.table("proposals")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .execute()
    )

    return result.data or []


def approve(proposal_id: str, approved_by: str = "Sensei") -> dict:
    """Approve a proposal.

    Args:
        proposal_id: UUID of the proposal
        approved_by: Who approved it

    Returns:
        The updated proposal dict
    """
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    now = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("proposals")
        .update({
            "status": "approved",
            "approved_at": now,
            "approved_by": approved_by,
        })
        .eq("id", proposal_id)
        .execute()
    )

    proposal = result.data[0] if result.data else {"id": proposal_id}

    emit("proposal_approved", {
        "proposal_id": proposal_id,
        "approved_by": approved_by,
        "agent": "system",
    })

    return proposal


def reject(proposal_id: str, reason: str = "") -> dict:
    """Reject a proposal.

    Args:
        proposal_id: UUID of the proposal
        reason: Why it was rejected

    Returns:
        The updated proposal dict
    """
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    now = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("proposals")
        .update({
            "status": "rejected",
            "updated_at": now,
        })
        .eq("id", proposal_id)
        .execute()
    )

    proposal = result.data[0] if result.data else {"id": proposal_id}

    emit("proposal_rejected", {
        "proposal_id": proposal_id,
        "reason": reason,
        "agent": "system",
    })

    return proposal
