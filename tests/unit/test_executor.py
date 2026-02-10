"""Tests for engine.executor — Step executor for Shogunate Engine."""

import subprocess
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, mock_open

import pytest


# ---------------------------------------------------------------------------
# _load_skill_md
# ---------------------------------------------------------------------------


class TestLoadSkillMd:
    """Test loading SKILL.md files for Daimyo agents."""

    @patch("engine.executor.DAIMYO_REGISTRY", {
        "atlas": {"name": "Atlas", "skill_path": "/tmp/test-skill.md"},
    })
    @patch("engine.executor.Path")
    def test_loads_existing_skill_file(self, mock_path_cls):
        from engine.executor import _load_skill_md

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = "# Atlas SKILL\nDo engineering."
        mock_path_cls.return_value = mock_path

        result = _load_skill_md("atlas")
        assert result == "# Atlas SKILL\nDo engineering."

    @patch("engine.executor.DAIMYO_REGISTRY", {
        "atlas": {"name": "Atlas", "skill_path": "/tmp/nonexistent.md"},
    })
    @patch("engine.executor.Path")
    def test_returns_empty_when_file_missing(self, mock_path_cls):
        from engine.executor import _load_skill_md

        mock_path = MagicMock()
        mock_path.exists.return_value = False
        mock_path_cls.return_value = mock_path

        result = _load_skill_md("atlas")
        assert result == ""

    @patch("engine.executor.DAIMYO_REGISTRY", {})
    def test_returns_empty_for_unknown_daimyo(self):
        from engine.executor import _load_skill_md

        result = _load_skill_md("unknown_agent")
        assert result == ""

    @patch("engine.executor.DAIMYO_REGISTRY", {
        "atlas": {"name": "Atlas"},  # no skill_path key
    })
    def test_returns_empty_when_no_skill_path(self):
        from engine.executor import _load_skill_md

        result = _load_skill_md("atlas")
        assert result == ""


# ---------------------------------------------------------------------------
# _spawn_claude
# ---------------------------------------------------------------------------


class TestSpawnClaude:
    """Test spawning headless Claude Code sessions."""

    @patch("engine.executor.subprocess.run")
    def test_successful_spawn(self, mock_run):
        from engine.executor import _spawn_claude

        mock_run.return_value = MagicMock(
            stdout="Task completed successfully.",
            stderr="",
            returncode=0,
        )

        stdout, stderr, code = _spawn_claude(
            skill_md="# Atlas SKILL",
            model="claude-sonnet-4-20250514",
            description="Implement file watcher",
            timeout_minutes=30,
        )

        assert stdout == "Task completed successfully."
        assert stderr == ""
        assert code == 0

        mock_run.assert_called_once_with(
            [
                "claude", "-p",
                "--system-prompt", "# Atlas SKILL",
                "--model", "claude-sonnet-4-20250514",
                "--dangerously-skip-permissions",
                "Implement file watcher",
            ],
            capture_output=True,
            text=True,
            timeout=1800,  # 30 * 60
        )

    @patch("engine.executor.subprocess.run")
    def test_timeout_raises(self, mock_run):
        from engine.executor import _spawn_claude

        mock_run.side_effect = subprocess.TimeoutExpired(
            cmd=["claude", "-p"], timeout=1800
        )

        with pytest.raises(subprocess.TimeoutExpired):
            _spawn_claude(
                skill_md="# Atlas",
                model="claude-sonnet-4-20250514",
                description="Long task",
                timeout_minutes=30,
            )

    @patch("engine.executor.subprocess.run")
    def test_claude_not_installed(self, mock_run):
        from engine.executor import _spawn_claude

        mock_run.side_effect = FileNotFoundError("claude not found")

        with pytest.raises(FileNotFoundError):
            _spawn_claude(
                skill_md="# Atlas",
                model="claude-sonnet-4-20250514",
                description="Some task",
                timeout_minutes=10,
            )

    @patch("engine.executor.subprocess.run")
    def test_nonzero_exit_code(self, mock_run):
        from engine.executor import _spawn_claude

        mock_run.return_value = MagicMock(
            stdout="",
            stderr="Error: something failed",
            returncode=1,
        )

        stdout, stderr, code = _spawn_claude(
            skill_md="# Atlas",
            model="claude-sonnet-4-20250514",
            description="Failing task",
            timeout_minutes=10,
        )

        assert code == 1
        assert stderr == "Error: something failed"


# ---------------------------------------------------------------------------
# execute_step
# ---------------------------------------------------------------------------


class TestExecuteStep:
    """Test full step execution flow."""

    def _make_step(self, **overrides):
        """Create a step dict for testing."""
        step = {
            "id": "step-001",
            "mission_id": "mission-001",
            "description": "Implement file watcher",
            "assigned_to": "atlas",
            "status": "running",
            "kind": "code",
            "output": None,
            "error": None,
            "timeout_minutes": 30,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        step.update(overrides)
        return step

    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_successful_step_execution(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# Atlas SKILL"
        mock_spawn.return_value = ("Output from Claude", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", output="Output from Claude")]
        )

        step = self._make_step()
        result = execute_step(step)

        assert result["status"] == "completed"
        assert result["output"] == "Output from Claude"
        mock_load.assert_called_once_with("atlas")
        mock_spawn.assert_called_once()
        mock_emit.assert_called_once()
        mock_check_mission.assert_called_once_with("mission-001")
        mock_update_agent.assert_called_once_with("atlas")

    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_step_failure_on_nonzero_exit(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# Atlas SKILL"
        mock_spawn.return_value = ("", "Error: crash", 1)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="failed", error="Error: crash")]
        )

        step = self._make_step()
        result = execute_step(step)

        assert result["status"] == "failed"
        assert result["error"] == "Error: crash"
        # step_failed event
        event_call = mock_emit.call_args
        assert event_call[0][0] == "step_failed"

    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_step_timeout_marks_failed(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# Atlas SKILL"
        mock_spawn.side_effect = subprocess.TimeoutExpired(cmd=["claude"], timeout=1800)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="failed", error="Step timed out after 30 minutes")]
        )

        step = self._make_step()
        result = execute_step(step)

        assert result["status"] == "failed"
        assert "timed out" in result["error"]

    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_step_claude_not_installed(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# Atlas SKILL"
        mock_spawn.side_effect = FileNotFoundError("claude not found")
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="failed", error="claude CLI not found")]
        )

        step = self._make_step()
        result = execute_step(step)

        assert result["status"] == "failed"
        assert "not found" in result["error"]


# ---------------------------------------------------------------------------
# _check_mission_complete
# ---------------------------------------------------------------------------


class TestCheckMissionComplete:
    """Test mission completion detection."""

    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    def test_marks_mission_completed_when_all_steps_done(self, mock_sb, mock_emit):
        from engine.executor import _check_mission_complete

        # Count query: no remaining non-terminal steps
        count_response = MagicMock()
        count_response.count = 0

        # Chain for SELECT count
        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.not_.return_value = select_chain
        select_chain.in_.return_value = select_chain
        select_chain.execute.return_value = count_response

        # Chain for UPDATE
        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[{"id": "m-001", "status": "completed"}])

        def table_router(name):
            if name == "steps":
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router

        _check_mission_complete("m-001")

        # Should have emitted mission_completed
        mock_emit.assert_called_once()
        assert mock_emit.call_args[0][0] == "mission_completed"

    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    def test_does_not_complete_mission_with_pending_steps(self, mock_sb, mock_emit):
        from engine.executor import _check_mission_complete

        count_response = MagicMock()
        count_response.count = 2  # still pending steps

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.not_.return_value = select_chain
        select_chain.in_.return_value = select_chain
        select_chain.execute.return_value = count_response

        mock_sb.table.return_value = select_chain

        _check_mission_complete("m-001")

        # Should NOT emit
        mock_emit.assert_not_called()


# ---------------------------------------------------------------------------
# _update_agent_status
# ---------------------------------------------------------------------------


class TestUpdateAgentStatus:
    """Test agent status updates after step completion."""

    @patch("engine.executor.supabase")
    def test_sets_idle_when_no_running_missions(self, mock_sb):
        from engine.executor import _update_agent_status

        # Count query: 0 running missions
        count_response = MagicMock()
        count_response.count = 0

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = count_response

        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[])

        call_count = [0]
        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:  # missions table for count
                return select_chain
            return update_chain  # agent_status table for update

        mock_sb.table.side_effect = table_router

        _update_agent_status("atlas")

        # Should have called update on agent_status
        update_chain.update.assert_called_once()
        update_args = update_chain.update.call_args[0][0]
        assert update_args["status"] == "idle"
        assert update_args["current_mission_id"] is None

    @patch("engine.executor.supabase")
    def test_does_not_update_when_missions_still_running(self, mock_sb):
        from engine.executor import _update_agent_status

        count_response = MagicMock()
        count_response.count = 1  # still has running mission

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = count_response

        mock_sb.table.return_value = select_chain

        _update_agent_status("atlas")

        # table should only be called once (for SELECT, not for UPDATE)
        assert mock_sb.table.call_count == 1


# ---------------------------------------------------------------------------
# execute_next
# ---------------------------------------------------------------------------


class TestExecuteNext:
    """Test finding and executing the next queued step."""

    @patch("engine.executor.execute_step")
    @patch("engine.executor.supabase")
    def test_finds_and_runs_queued_step(self, mock_sb, mock_exec):
        from engine.executor import execute_next

        queued_step = {
            "id": "step-099",
            "mission_id": "m-005",
            "description": "Build API",
            "assigned_to": "atlas",
            "status": "queued",
            "timeout_minutes": 30,
            "created_at": "2025-01-01T00:00:00Z",
        }

        # Query chain for finding queued step
        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.order.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[queued_step])

        # Update chain for marking as running
        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[{**queued_step, "status": "running"}])

        call_count = [0]
        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router
        mock_exec.return_value = {**queued_step, "status": "completed", "output": "Done"}

        result = execute_next()

        assert result is not None
        assert result["status"] == "completed"
        mock_exec.assert_called_once()

    @patch("engine.executor.supabase")
    def test_returns_none_when_no_queued_steps(self, mock_sb):
        from engine.executor import execute_next

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.order.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = select_chain

        result = execute_next()
        assert result is None


# ---------------------------------------------------------------------------
# execute_mission
# ---------------------------------------------------------------------------


class TestExecuteMission:
    """Test executing all steps for a mission."""

    @patch("engine.executor.execute_step")
    @patch("engine.executor.supabase")
    def test_executes_all_steps_sequentially(self, mock_sb, mock_exec):
        from engine.executor import execute_mission

        steps = [
            {"id": "s1", "mission_id": "m-001", "description": "Step 1",
             "assigned_to": "atlas", "status": "queued", "timeout_minutes": 30},
            {"id": "s2", "mission_id": "m-001", "description": "Step 2",
             "assigned_to": "atlas", "status": "queued", "timeout_minutes": 30},
            {"id": "s3", "mission_id": "m-001", "description": "Step 3",
             "assigned_to": "atlas", "status": "queued", "timeout_minutes": 30},
        ]

        # Query for fetching mission steps
        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.order.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=steps)

        # Update chain for marking steps as running
        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[])

        call_count = [0]
        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router

        mock_exec.side_effect = [
            {**steps[0], "status": "completed", "output": "Done 1"},
            {**steps[1], "status": "completed", "output": "Done 2"},
            {**steps[2], "status": "completed", "output": "Done 3"},
        ]

        results = execute_mission("m-001")

        assert len(results) == 3
        assert all(r["status"] == "completed" for r in results)
        assert mock_exec.call_count == 3

    @patch("engine.executor.execute_step")
    @patch("engine.executor.supabase")
    def test_returns_empty_list_for_no_steps(self, mock_sb, mock_exec):
        from engine.executor import execute_mission

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.order.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = select_chain

        results = execute_mission("m-nonexistent")

        assert results == []
        mock_exec.assert_not_called()
