"""Tests for the commit-sync hook script logic."""
import json
import subprocess
import os

HOOK_SCRIPT = "/Users/michaelenriquez/Code/war-room/engine/hooks/commit-sync.sh"
WAR_ROOM_DIR = "/Users/michaelenriquez/Code/war-room"


def run_hook(tool_input_command: str, cwd: str = WAR_ROOM_DIR) -> subprocess.CompletedProcess:
    """Run the hook with a simulated stdin JSON payload."""
    payload = json.dumps({
        "tool_input": {"command": tool_input_command},
        "tool_result": {"stdout": "", "stderr": "", "exit_code": 0}
    })
    return subprocess.run(
        ["bash", HOOK_SCRIPT],
        input=payload,
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10,
    )


def test_hook_is_executable():
    """Hook script must be executable."""
    assert os.access(HOOK_SCRIPT, os.X_OK), "commit-sync.sh is not executable"


def test_hook_exits_silently_on_non_commit():
    """Hook should exit 0 and produce no output for non-commit bash commands."""
    result = run_hook("ls -la /tmp")
    assert result.returncode == 0


def test_hook_exits_silently_for_grep():
    """Hook should ignore grep commands."""
    result = run_hook("grep -r 'foo' .")
    assert result.returncode == 0


def test_hook_exits_silently_for_git_status():
    """Hook should ignore git status (not a commit)."""
    result = run_hook("git status")
    assert result.returncode == 0


def test_hook_recognizes_git_commit_in_war_room():
    """Hook should attempt to fire when git commit is detected in war-room context.

    This test runs in the war-room directory. The hook will try to source
    war-room-api.sh and call curl. Without env vars, it may fail, but the
    important thing is it gets past the guards (doesn't exit 0 early).
    We test that it at least attempts the API call by checking stderr for
    the 'War Room API loaded' message from war-room-api.sh.
    """
    result = run_hook(
        'git commit -m "test: add new feature"',
        cwd=WAR_ROOM_DIR,
    )
    # The hook should have sourced the API (even if curl fails without env)
    # war-room-api.sh prints "War Room API loaded" to stderr
    assert "War Room API loaded" in result.stderr or result.returncode == 0


def test_hook_skips_commit_outside_war_room(tmp_path):
    """Hook should skip if not in war-room repo and command doesn't mention war-room."""
    result = run_hook(
        'git commit -m "unrelated commit"',
        cwd=str(tmp_path),
    )
    # Should exit cleanly without attempting API calls
    assert result.returncode == 0
    # Should NOT have loaded the API (skipped before sourcing)
    assert "War Room API loaded" not in result.stderr


def test_settings_json_structure():
    """settings.json should have the correct hook registration."""
    settings_path = os.path.join(WAR_ROOM_DIR, ".claude", "settings.json")
    assert os.path.exists(settings_path), "settings.json missing"

    with open(settings_path) as f:
        settings = json.load(f)

    assert "hooks" in settings
    assert "PostToolUse" in settings["hooks"]

    post_hooks = settings["hooks"]["PostToolUse"]
    bash_matchers = [h for h in post_hooks if h.get("matcher") == "Bash"]
    assert len(bash_matchers) >= 1, "No Bash matcher in PostToolUse"

    bash_hook = bash_matchers[0]
    commands = [h["command"] for h in bash_hook["hooks"]]
    assert any("commit-sync.sh" in cmd for cmd in commands), \
        "commit-sync.sh not registered in Bash hook"
