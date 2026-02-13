"""Shogunate Engine mission runner."""

from datetime import datetime, timezone
from engine.config import supabase, DAIMYO_REGISTRY, WORKER_MODEL
from engine.events import emit
from engine.relationships import get_best_collaborator


# Build reverse mapping from domain to daimyo ID
DOMAIN_TO_DAIMYO = {v["domain"]: k for k, v in DAIMYO_REGISTRY.items()}


def create_mission(
    proposal_id: str,
    title: str,
    description: str,
    assigned_to: str,
    steps: list[dict],
    project_id: str | None = None,
) -> dict:
    """Create a mission with steps, using affinity-aware assignment.

    Args:
        proposal_id: UUID of the proposal
        title: Mission title
        description: Mission description
        assigned_to: Primary daimyo ID (e.g., 'ed', 'light')
        steps: List of step dicts with {title, description, kind, domain}
        project_id: Optional project UUID

    Returns:
        The created mission dict
    """
    if not supabase:
        raise RuntimeError("Supabase client not initialized")

    # 1. Insert mission
    mission_data = {
        "proposal_id": proposal_id,
        "project_id": project_id,
        "title": title,
        "assigned_to": assigned_to,
        "status": "queued",
    }

    result = supabase.table("missions").insert(mission_data).execute()
    mission = result.data[0]
    mission_id = mission["id"]

    # 2. Insert steps with affinity-aware assignment
    created_steps = []
    for step in steps:
        # Assign daimyo based on domain
        domain = step.get("domain", "engineering")
        direct_daimyo = DOMAIN_TO_DAIMYO.get(domain)

        if direct_daimyo:
            daimyo_id = direct_daimyo
        else:
            # No direct domain match — use affinity to pick best collaborator
            candidates = list(DAIMYO_REGISTRY.keys())
            daimyo_id = get_best_collaborator(assigned_to, candidates)

        step_data = {
            "mission_id": mission_id,
            "title": step["title"],
            "description": step.get("description"),
            "kind": step.get("kind", "code"),
            "daimyo": daimyo_id,
            "model": WORKER_MODEL,
            "status": "queued",
            "timeout_minutes": step.get("timeout_minutes", 30),
        }

        step_result = supabase.table("steps").insert(step_data).execute()
        created_steps.append(step_result.data[0])

    # 3. Emit mission_started event
    emit(
        "mission_started",
        {
            "mission_id": mission_id,
            "proposal_id": proposal_id,
            "title": title,
            "assigned_to": assigned_to,
            "step_count": len(created_steps),
        },
    )

    # Return mission with steps
    mission["steps"] = created_steps
    return mission


def run_pending() -> list[dict]:
    """Find approved proposals without missions and create missions for them.

    Returns:
        List of created mission dicts
    """
    if not supabase:
        return []

    # 1. Query approved proposals
    proposals_result = supabase.table("proposals").select("*").eq("status", "approved").execute()

    if not proposals_result.data:
        return []

    # Get existing mission proposal IDs to avoid duplicates
    missions_result = supabase.table("missions").select("proposal_id").execute()
    existing_proposal_ids = {m["proposal_id"] for m in missions_result.data if m.get("proposal_id")}

    pending_proposals = [p for p in proposals_result.data if p["id"] not in existing_proposal_ids]

    created_missions = []

    for proposal in pending_proposals:
        # K2.5 heuristic: research -> code -> review
        steps = [
            {
                "title": f"Research: {proposal['title']}",
                "description": f"Research and plan implementation for: {proposal.get('description', '')}",
                "kind": "research",
                "domain": proposal.get("domain", "engineering"),
            },
            {
                "title": f"Implement: {proposal['title']}",
                "description": f"Code implementation for: {proposal.get('description', '')}",
                "kind": "code",
                "domain": proposal.get("domain", "engineering"),
            },
            {
                "title": f"Review: {proposal['title']}",
                "description": f"Review and validate implementation of: {proposal.get('description', '')}",
                "kind": "review",
                "domain": proposal.get("domain", "engineering"),
            },
        ]

        domain = proposal.get("domain", "engineering")
        assigned_to = DOMAIN_TO_DAIMYO.get(domain, "ed")

        mission = create_mission(
            proposal_id=proposal["id"],
            title=proposal["title"],
            description=proposal.get("description", ""),
            assigned_to=assigned_to,
            steps=steps,
            project_id=proposal.get("project_id"),
        )

        created_missions.append(mission)

    return created_missions
