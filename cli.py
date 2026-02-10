"""Shogunate Engine CLI."""

import click
import os
import subprocess
import sys


@click.group()
def cli():
    """Shogunate Engine - War Room agent orchestration."""
    pass


@cli.command("execute-next")
def execute_next_cmd():
    """Execute the next queued step."""
    from engine.executor import execute_next

    step = execute_next()
    if step:
        click.echo(f"Executed step {step['id']}: {step['status']}")
    else:
        click.echo("No queued steps")


@cli.command("execute-mission")
@click.argument("mission_id")
def execute_mission_cmd(mission_id):
    """Execute all steps for a mission."""
    from engine.executor import execute_mission

    steps = execute_mission(mission_id)
    click.echo(f"Executed {len(steps)} steps for mission {mission_id}")


@cli.group()
def wr():
    """War Room task management."""
    pass


@wr.command("status")
def wr_status():
    """Show dynasty overview."""
    from engine.config import supabase
    from datetime import datetime, timezone, timedelta

    if not supabase:
        click.echo("Supabase not configured")
        return

    # Count projects by status
    projects = supabase.table("projects").select("status").execute()
    proj_counts = {}
    for p in (projects.data or []):
        s = p["status"]
        proj_counts[s] = proj_counts.get(s, 0) + 1

    # Count tasks by status
    tasks = supabase.table("tasks").select("status, updated_at").execute()
    task_counts = {}
    stale_count = 0
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    for t in (tasks.data or []):
        s = t["status"]
        task_counts[s] = task_counts.get(s, 0) + 1
        if t["updated_at"] < cutoff and s not in ("done", "someday"):
            stale_count += 1

    # Count pending proposals
    proposals = (
        supabase.table("proposals")
        .select("id", count="exact")
        .eq("status", "pending")
        .execute()
    )

    click.echo(click.style("=== Dynasty Status ===", bold=True))
    click.echo()
    click.echo(click.style("Projects:", bold=True))
    for status, count in sorted(proj_counts.items()):
        click.echo(f"  {status}: {count}")
    click.echo()
    click.echo(click.style("Tasks:", bold=True))
    for status, count in sorted(task_counts.items()):
        click.echo(f"  {status}: {count}")
    click.echo()
    click.echo(f"Pending proposals: {proposals.count or 0}")
    click.echo(f"Stale tasks (7d+): {click.style(str(stale_count), fg='yellow')}")


@wr.command("tasks")
@click.option("--project", default=None, help="Filter by project name")
@click.option("--stale", is_flag=True, help="Show only stale tasks (7+ days inactive)")
def wr_tasks(project, stale):
    """List tasks."""
    from engine.config import supabase
    from datetime import datetime, timezone, timedelta

    if not supabase:
        click.echo("Supabase not configured")
        return

    query = (
        supabase.table("tasks")
        .select("*, projects(title)")
        .order("updated_at", desc=True)
    )
    tasks = query.execute()
    rows = tasks.data or []

    if project:
        rows = [
            r
            for r in rows
            if r.get("projects", {})
            and project.lower() in r["projects"]["title"].lower()
        ]

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    if stale:
        rows = [
            r
            for r in rows
            if r["updated_at"] < cutoff and r["status"] not in ("done", "someday")
        ]

    if not rows:
        click.echo("No tasks found.")
        return

    for r in rows:
        proj_name = (
            r.get("projects", {}).get("title", "—") if r.get("projects") else "—"
        )
        stale_flag = (
            " [STALE]"
            if r["updated_at"] < cutoff and r["status"] not in ("done", "someday")
            else ""
        )
        owner = r.get("owner") or "unassigned"
        click.echo(
            f"  #{r['id']}  {r['status']:12s}  {r['title'][:40]:40s}"
            f"  {proj_name[:20]:20s}  {owner}{stale_flag}"
        )


@wr.command("start")
@click.argument("task_id", type=int)
def wr_start(task_id):
    """Set task to in_progress."""
    from engine.config import supabase
    from datetime import datetime, timezone

    if not supabase:
        click.echo("Supabase not configured")
        return

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("tasks").update(
        {"status": "in_progress", "updated_at": now}
    ).eq("id", task_id).execute()
    supabase.table("events").insert(
        {"type": "user_request", "message": f"Task #{task_id} started (in_progress)"}
    ).execute()
    click.echo(click.style(f"Task #{task_id} → in_progress", fg="blue"))


@wr.command("done")
@click.argument("task_id", type=int)
def wr_done(task_id):
    """Set task to review."""
    from engine.config import supabase
    from datetime import datetime, timezone

    if not supabase:
        click.echo("Supabase not configured")
        return

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("tasks").update(
        {"status": "review", "updated_at": now}
    ).eq("id", task_id).execute()
    supabase.table("events").insert(
        {"type": "user_request", "message": f"Task #{task_id} done (moved to review)"}
    ).execute()
    click.echo(click.style(f"Task #{task_id} → review", fg="magenta"))


@wr.command("approve")
@click.argument("task_id", type=int)
def wr_approve(task_id):
    """Set task to done."""
    from engine.config import supabase
    from datetime import datetime, timezone

    if not supabase:
        click.echo("Supabase not configured")
        return

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("tasks").update(
        {"status": "done", "completed_at": now, "updated_at": now}
    ).eq("id", task_id).execute()
    supabase.table("events").insert(
        {"type": "user_request", "message": f"Task #{task_id} approved (done)"}
    ).execute()
    click.echo(click.style(f"Task #{task_id} → done", fg="green"))


@wr.command("propose")
@click.argument("title")
@click.option("--project", default=None, help="Project ID to attach proposal to")
@click.option("--council", is_flag=True, help="Route through Daimyo council review")
@click.option("--domain", default=None, help="Domain: engineering, product, commerce, influence, operations, coordination")
@click.option("--risk", default=None, help="Risk level: low, medium, high")
def wr_propose(title, project, council, domain, risk):
    """Create a proposal."""
    from engine.config import supabase

    if not supabase:
        click.echo("Supabase not configured")
        return

    data = {
        "title": title,
        "source": "manual",
        "requested_by": "sensei",
        "status": "pending",
    }
    if project:
        data["project_id"] = project
    if council:
        data["council_review"] = True
    if domain:
        data["domain"] = domain
    if risk:
        data["risk_level"] = risk

    result = supabase.table("proposals").insert(data).execute()
    if result.data:
        click.echo(click.style(f"Proposal created: {title}", fg="cyan"))
        if project:
            click.echo(f"  → Linked to project: {project}")
        if council:
            click.echo("  → Flagged for council review")
    else:
        click.echo(click.style("Failed to create proposal", fg="red"))


@wr.command("event")
@click.argument("message")
def wr_event(message):
    """Log a manual event."""
    from engine.config import supabase

    if not supabase:
        click.echo("Supabase not configured")
        return

    supabase.table("events").insert(
        {"type": "user_request", "message": message}
    ).execute()
    click.echo(click.style(f"Event logged: {message}", fg="green"))


@wr.command("dispatch")
@click.argument("mission_id", required=False, default=None)
def wr_dispatch(mission_id):
    """Trigger engine execution. Optionally specify a mission ID."""
    engine_dir = os.path.expanduser("~/Code/shogunate-engine")

    if mission_id:
        click.echo(click.style(f"Dispatching mission {mission_id}...", fg="cyan"))
        result = subprocess.run(
            [sys.executable, "cli.py", "execute-mission", mission_id],
            cwd=engine_dir,
            capture_output=True,
            text=True,
        )
    else:
        # First: create missions from approved proposals
        click.echo(click.style("Running pending mission creation...", fg="cyan"))
        result = subprocess.run(
            [sys.executable, "-c", "from engine.mission import run_pending; run_pending()"],
            cwd=engine_dir,
            capture_output=True,
            text=True,
        )
        if result.stdout:
            click.echo(result.stdout.strip())
        if result.returncode != 0 and result.stderr:
            click.echo(click.style(f"Warning: {result.stderr.strip()}", fg="yellow"))

        # Then: execute next queued step
        click.echo(click.style("Executing next queued step...", fg="cyan"))
        result = subprocess.run(
            [sys.executable, "cli.py", "execute-next"],
            cwd=engine_dir,
            capture_output=True,
            text=True,
        )

    if result.stdout:
        click.echo(result.stdout.strip())
    if result.returncode != 0:
        if result.stderr:
            click.echo(click.style(f"Engine error: {result.stderr.strip()}", fg="red"))
        click.echo(click.style("Dispatch failed", fg="red"))
    else:
        click.echo(click.style("Dispatch complete", fg="green"))


if __name__ == "__main__":
    cli()
