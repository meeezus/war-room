"""Shogunate Engine memory system.

Extracts learnings from step outputs and stores in agent_memory table.
Retrieves relevant memories for prompt injection.
"""

import subprocess
import json
from datetime import datetime, timezone

from engine.config import supabase, CHEAP_MODEL


def extract_and_store(step: dict, output: str) -> list[dict]:
    """Extract learnings from step output and store in agent_memory.

    Uses a lightweight Claude call (Haiku) to extract key decisions,
    patterns, and what worked/failed from the step output.

    Args:
        step: The completed step dict (must have daimyo, mission_id, title)
        output: The step's stdout output

    Returns:
        List of stored memory dicts
    """
    if not supabase or not output or not output.strip():
        return []

    daimyo_id = step.get("daimyo") or step.get("assigned_to", "ed")
    mission_id = step.get("mission_id")
    step_title = step.get("title", "unknown step")

    # Use Haiku for cheap extraction
    extraction_prompt = f"""Analyze this step output and extract 1-3 key learnings.

Step: {step_title}
Agent: {daimyo_id}

Output:
{output[:3000]}

Return a JSON array of objects with these fields:
- "memory_type": one of "insight", "pattern", "decision", "solution", "warning"
- "content": concise description of the learning (1-2 sentences)
- "tags": array of 2-4 relevant tags
- "confidence": float 0.0-1.0

Example:
[{{"memory_type": "solution", "content": "Fixed auth by adding null check before profile access", "tags": ["auth", "null-check", "debugging"], "confidence": 0.85}}]

Return ONLY the JSON array, no other text."""

    try:
        result = subprocess.run(
            [
                "claude", "-p",
                "--model", CHEAP_MODEL,
                extraction_prompt,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            return []

        # Parse the JSON response
        raw = result.stdout.strip()
        # Handle markdown code blocks
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        memories = json.loads(raw)
        if not isinstance(memories, list):
            return []

    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
        return []

    # Store each memory
    stored = []
    now = datetime.now(timezone.utc).isoformat()

    for mem in memories[:3]:  # Cap at 3
        memory_data = {
            "agent_id": daimyo_id,
            "memory_type": mem.get("memory_type", "insight"),
            "content": mem.get("content", ""),
            "tags": mem.get("tags", []),
            "confidence": min(max(mem.get("confidence", 0.5), 0.0), 1.0),
            "source_mission_id": mission_id,
            "status": "active",
            "created_at": now,
        }

        try:
            result = supabase.table("agent_memory").insert(memory_data).execute()
            if result.data:
                stored.append(result.data[0])
        except Exception:
            continue

    return stored


def get_relevant_memories(
    agent_id: str,
    task_description: str = "",
    limit: int = 5,
) -> list[dict]:
    """Retrieve recent relevant memories for an agent.

    Args:
        agent_id: The daimyo ID (e.g., 'ed', 'light')
        task_description: Optional task context for relevance (unused for now, future: semantic search)
        limit: Max memories to return

    Returns:
        List of memory dicts ordered by confidence DESC, created_at DESC
    """
    if not supabase:
        return []

    try:
        result = (
            supabase.table("agent_memory")
            .select("*")
            .eq("agent_id", agent_id)
            .eq("status", "active")
            .order("confidence", desc=True)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception:
        return []


def format_memories_section(memories: list[dict]) -> str:
    """Format memories as a markdown section for prompt injection.

    Args:
        memories: List of memory dicts from get_relevant_memories()

    Returns:
        Markdown string to append to system prompt, or empty string if no memories
    """
    if not memories:
        return ""

    lines = ["\n\n## Recent Memories\n"]
    for mem in memories:
        mtype = mem.get("memory_type", "insight")
        content = mem.get("content", "")
        confidence = mem.get("confidence", 0.5)
        lines.append(f"- [{mtype}] {content} (confidence: {confidence:.1f})")

    return "\n".join(lines)
