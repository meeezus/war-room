"""Shogunate Engine Step Executor.

Runs individual steps by spawning headless Claude Code sessions
with the assigned Daimyo's SKILL.md as system prompt.
"""

import subprocess
from pathlib import Path
from datetime import datetime, timezone

from engine.config import supabase, DAIMYO_REGISTRY, WORKER_MODEL, DEFAULT_TIMEOUT_MINUTES
from engine.events import emit


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_skill_md(daimyo_id: str) -> str:
    """Load SKILL.md from DAIMYO_REGISTRY.

    Returns the file contents, or empty string if not found.
    """
    info = DAIMYO_REGISTRY.get(daimyo_id, {})
    skill_path = info.get("skill_path")
    if skill_path and Path(skill_path).exists():
        return Path(skill_path).read_text()
    return ""


def _spawn_claude(
    skill_md: str,
    model: str,
    description: str,
    timeout_minutes: int,
) -> tuple[str, str, int]:
    """Spawn claude -p and capture output.

    Returns (stdout, stderr, returncode).
    Raises subprocess.TimeoutExpired on timeout.
    Raises FileNotFoundError if claude CLI is not installed.
    """
    result = subprocess.run(
        [
            "claude", "-p",
            "--system-prompt", skill_md,
            "--model", model,
            "--dangerously-skip-permissions",
            description,
        ],
        capture_output=True,
        text=True,
        timeout=timeout_minutes * 60,
    )
    return result.stdout, result.stderr, result.returncode


def _check_mission_complete(mission_id: str) -> None:
    """Check if all steps for a mission are terminal. If so, mark mission completed."""
    if not supabase:
        return

    # Count non-terminal steps
    result = (
        supabase.table("steps")
        .select("id", count="exact")
        .eq("mission_id", mission_id)
        .not_("status", "in", "(completed,failed)")
        .execute()
    )

    remaining = result.count
    if remaining is not None and remaining == 0:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("missions").update({
            "status": "completed",
            "completed_at": now,
        }).eq("id", mission_id).execute()

        emit("mission_completed", {
            "mission_id": mission_id,
            "completed_at": now,
        })


def _update_agent_status(daimyo_id: str) -> None:
    """Update agent status. If no running missions, set to idle."""
    if not supabase:
        return

    result = (
        supabase.table("missions")
        .select("id", count="exact")
        .eq("assigned_to", daimyo_id)
        .eq("status", "running")
        .execute()
    )

    running = result.count
    if running is not None and running == 0:
        supabase.table("agent_status").update({
            "status": "idle",
            "current_mission_id": None,
        }).eq("daimyo_id", daimyo_id).execute()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def execute_step(step: dict) -> dict:
    """Execute a single step via claude -p.

    1. Load SKILL.md for the step's Daimyo
    2. Spawn claude -p with skill as system prompt
    3. Capture stdout/stderr with timeout
    4. Update step in Supabase: status, output/error, completed_at
    5. Emit step_completed or step_failed event
    6. Check if all steps for the mission are complete
    7. Update agent_status if no more active missions
    8. Return updated step dict
    """
    daimyo_id = step["assigned_to"]
    mission_id = step["mission_id"]
    timeout = step.get("timeout_minutes", DEFAULT_TIMEOUT_MINUTES)
    description = step["description"]

    # 1. Load skill
    skill_md = _load_skill_md(daimyo_id)

    # 2-3. Spawn claude and capture output
    status = "completed"
    output = None
    error = None

    try:
        stdout, stderr, returncode = _spawn_claude(
            skill_md=skill_md,
            model=WORKER_MODEL,
            description=description,
            timeout_minutes=timeout,
        )

        if returncode == 0:
            status = "completed"
            output = stdout
        else:
            status = "failed"
            error = stderr or f"claude exited with code {returncode}"

    except subprocess.TimeoutExpired:
        status = "failed"
        error = f"Step timed out after {timeout} minutes"

    except FileNotFoundError:
        status = "failed"
        error = "claude CLI not found — is it installed and on PATH?"

    # 4. Update step in Supabase
    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "status": status,
        "output": output,
        "error": error,
        "completed_at": now,
    }

    updated_step = step.copy()
    updated_step.update(update_data)

    if supabase:
        result = (
            supabase.table("steps")
            .update(update_data)
            .eq("id", step["id"])
            .execute()
        )
        if result.data:
            updated_step = result.data[0]

    # 5. Emit event
    event_type = "step_completed" if status == "completed" else "step_failed"
    emit(event_type, {
        "step_id": step["id"],
        "mission_id": mission_id,
        "status": status,
        "output": output,
        "error": error,
    })

    # 6. Check mission completion
    _check_mission_complete(mission_id)

    # 7. Update agent status
    _update_agent_status(daimyo_id)

    # 8. Return
    return updated_step


def execute_next() -> dict | None:
    """Find next queued step and execute it.

    1. Query steps WHERE status='queued' ORDER BY created_at LIMIT 1
    2. Mark it as 'running', set started_at
    3. Call execute_step()
    4. Return the step, or None if no queued steps
    """
    if not supabase:
        return None

    # Find next queued step
    result = (
        supabase.table("steps")
        .select("*")
        .eq("status", "queued")
        .order("created_at")
        .limit(1)
        .execute()
    )

    if not result.data:
        return None

    step = result.data[0]

    # Mark as running
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("steps").update({
        "status": "running",
        "started_at": now,
    }).eq("id", step["id"]).execute()

    step["status"] = "running"
    step["started_at"] = now

    # Execute
    return execute_step(step)


def execute_mission(mission_id: str) -> list[dict]:
    """Execute all steps for a mission sequentially.

    Returns list of completed/failed step dicts.
    """
    if not supabase:
        return []

    # Fetch all steps for mission, ordered by creation
    result = (
        supabase.table("steps")
        .select("*")
        .eq("mission_id", mission_id)
        .order("created_at")
        .execute()
    )

    steps = result.data or []
    results = []

    for step in steps:
        # Mark as running
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("steps").update({
            "status": "running",
            "started_at": now,
        }).eq("id", step["id"]).execute()

        step["status"] = "running"
        step["started_at"] = now

        # Execute
        completed = execute_step(step)
        results.append(completed)

    return results
