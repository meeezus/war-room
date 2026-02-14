"""Shogunate Engine 10s Polling Daemon.

Polls Supabase every 10 seconds for:
1. Approved proposals without missions -> creates missions
2. Queued steps -> executes next step
3. Stale running steps -> marks as failed

Usage: python -m engine.poller
"""

import time
import json
import os
import sys
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

from engine.config import supabase, DEFAULT_TIMEOUT_MINUTES
from engine.mission import run_pending
from engine.executor import execute_next
from engine.events import emit

# Configuration
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))
STATE_FILE = os.path.expanduser("~/.warroom/poller_state.json")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [poller] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("poller")


def load_state() -> dict:
    """Load poller state from disk."""
    if Path(STATE_FILE).exists():
        try:
            return json.loads(Path(STATE_FILE).read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_state(state: dict) -> None:
    """Persist poller state to disk."""
    Path(STATE_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(STATE_FILE).write_text(json.dumps(state, indent=2))


def detect_stale_steps() -> int:
    """Find steps stuck in 'running' past timeout and mark as failed.

    Returns count of stale steps found.
    """
    if not supabase:
        return 0

    # Query running steps
    result = (
        supabase.table("steps")
        .select("id, started_at, timeout_minutes, mission_id")
        .eq("status", "running")
        .execute()
    )

    if not result.data:
        return 0

    now = datetime.now(timezone.utc)
    stale_count = 0

    for step in result.data:
        started_at = step.get("started_at")
        if not started_at:
            continue

        timeout = step.get("timeout_minutes", DEFAULT_TIMEOUT_MINUTES)
        if timeout is None:
            timeout = DEFAULT_TIMEOUT_MINUTES
        started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))

        if now - started > timedelta(minutes=timeout):
            # Mark as failed
            supabase.table("steps").update({
                "status": "failed",
                "error": f"Step timed out after {timeout} minutes (detected by poller)",
                "completed_at": now.isoformat(),
            }).eq("id", step["id"]).execute()

            emit("step_stale", {
                "step_id": step["id"],
                "mission_id": step.get("mission_id"),
                "timeout_minutes": timeout,
                "agent": "poller",
            })

            stale_count += 1
            log.warning(f"Stale step {step['id']} marked as failed (>{timeout}min)")

    return stale_count


def poll_cycle(state: dict) -> dict:
    """Run one poll cycle. Returns updated state."""
    cycle_start = datetime.now(timezone.utc).isoformat()

    # 1. Convert approved proposals -> missions
    try:
        new_missions = run_pending()
        if new_missions:
            log.info(f"Created {len(new_missions)} mission(s) from approved proposals")
            for m in new_missions:
                log.info(f"  -> {m['title']} (assigned: {m['assigned_to']})")
    except Exception as e:
        log.error(f"run_pending() error: {e}")
        new_missions = []

    # 2. Execute next queued step
    try:
        step_result = execute_next()
        if step_result:
            log.info(f"Executed step: {step_result.get('title', step_result['id'])} -> {step_result['status']}")
        # If no step, that's normal -- nothing queued
    except Exception as e:
        log.error(f"execute_next() error: {e}")
        step_result = None

    # 3. Detect and handle stale steps
    try:
        stale_count = detect_stale_steps()
        if stale_count:
            log.warning(f"Found {stale_count} stale step(s)")
    except Exception as e:
        log.error(f"detect_stale_steps() error: {e}")
        stale_count = 0

    # 4. Emit heartbeat
    try:
        emit("heartbeat", {
            "agent": "poller",
            "new_missions": len(new_missions),
            "step_executed": step_result is not None,
            "stale_detected": stale_count,
            "timestamp": cycle_start,
        })
    except Exception as e:
        log.error(f"heartbeat emit error: {e}")

    # 5. Update state
    state["last_run"] = cycle_start
    state["steps_processed"] = state.get("steps_processed", 0) + (1 if step_result else 0)
    state["consecutive_errors"] = 0  # Reset on successful cycle

    return state


def main():
    """Main polling loop."""
    if not supabase:
        log.error("Supabase client not initialized. Set SUPABASE_URL and SUPABASE_KEY env vars.")
        sys.exit(1)

    log.info("Shogunate Poller started")
    log.info(f"  Interval: {POLL_INTERVAL}s")
    log.info(f"  State: {STATE_FILE}")
    log.info("  Press Ctrl+C to stop\n")

    state = load_state()

    try:
        while True:
            try:
                state = poll_cycle(state)
                save_state(state)
            except Exception as e:
                state["consecutive_errors"] = state.get("consecutive_errors", 0) + 1
                log.error(f"Poll cycle error ({state['consecutive_errors']} consecutive): {e}")
                save_state(state)

                # Back off if too many consecutive errors
                if state["consecutive_errors"] >= 5:
                    log.error("5 consecutive errors -- backing off to 60s")
                    time.sleep(60)
                    continue

            time.sleep(POLL_INTERVAL)

    except KeyboardInterrupt:
        log.info("\nPoller stopped by user")
        save_state(state)


if __name__ == "__main__":
    main()
