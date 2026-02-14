"""Tests for engine.executor — Step executor for Shogunate Engine."""

import subprocess
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, mock_open

import pytest


# ---------------------------------------------------------------------------
# Config: Three-tier model constants
# ---------------------------------------------------------------------------


class TestModelConfig:
    """Test that config.py exposes the three-tier model strategy."""

    def test_cheap_model_exists(self):
        from engine.config import CHEAP_MODEL
        assert CHEAP_MODEL is not None
        assert "haiku" in CHEAP_MODEL.lower()

    def test_worker_model_updated(self):
        from engine.config import WORKER_MODEL
        assert WORKER_MODEL is not None
        # Should be updated to sonnet-4-5 (not old sonnet-4)
        assert "sonnet-4-5" in WORKER_MODEL or "WORKER_MODEL" in str(WORKER_MODEL)

    def test_orchestrator_model_exists(self):
        from engine.config import ORCHESTRATOR_MODEL
        assert ORCHESTRATOR_MODEL is not None
        assert "opus" in ORCHESTRATOR_MODEL.lower()

    def test_models_are_distinct(self):
        from engine.config import CHEAP_MODEL, WORKER_MODEL, ORCHESTRATOR_MODEL
        assert CHEAP_MODEL != WORKER_MODEL
        assert WORKER_MODEL != ORCHESTRATOR_MODEL
        assert CHEAP_MODEL != ORCHESTRATOR_MODEL


# ---------------------------------------------------------------------------
# _should_escalate
# ---------------------------------------------------------------------------


class TestShouldEscalate:
    """Test domain-based escalation logic."""

    @patch("engine.executor.DAIMYO_REGISTRY", {
        "ed": {"name": "Ed", "domain": "engineering"},
        "light": {"name": "Light", "domain": "product"},
        "toji": {"name": "Toji", "domain": "commerce"},
    })
    @patch("engine.executor.supabase")
    def test_escalates_when_three_or_more_domains(self, mock_sb):
        from engine.executor import _should_escalate

        # Steps assigned to 3 different daimyo with 3 different domains
        steps_data = [
            {"assigned_to": "ed"},
            {"assigned_to": "light"},
            {"assigned_to": "toji"},
        ]

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=steps_data)

        mock_sb.table.return_value = select_chain

        assert _should_escalate("mission-001") is True

    @patch("engine.executor.DAIMYO_REGISTRY", {
        "ed": {"name": "Ed", "domain": "engineering"},
        "light": {"name": "Light", "domain": "product"},
    })
    @patch("engine.executor.supabase")
    def test_does_not_escalate_with_two_domains(self, mock_sb):
        from engine.executor import _should_escalate

        steps_data = [
            {"assigned_to": "ed"},
            {"assigned_to": "light"},
        ]

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=steps_data)

        mock_sb.table.return_value = select_chain

        assert _should_escalate("mission-001") is False

    @patch("engine.executor.DAIMYO_REGISTRY", {
        "ed": {"name": "Ed", "domain": "engineering"},
    })
    @patch("engine.executor.supabase")
    def test_does_not_escalate_single_domain(self, mock_sb):
        from engine.executor import _should_escalate

        steps_data = [
            {"assigned_to": "ed"},
            {"assigned_to": "ed"},
            {"assigned_to": "ed"},
        ]

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=steps_data)

        mock_sb.table.return_value = select_chain

        assert _should_escalate("mission-001") is False

    @patch("engine.executor.supabase", None)
    def test_returns_false_when_no_supabase(self):
        from engine.executor import _should_escalate

        assert _should_escalate("mission-001") is False

    @patch("engine.executor.DAIMYO_REGISTRY", {
        "ed": {"name": "Ed", "domain": "engineering"},
    })
    @patch("engine.executor.supabase")
    def test_handles_unknown_daimyo_gracefully(self, mock_sb):
        from engine.executor import _should_escalate

        # One known daimyo, two unknown (no domain info)
        steps_data = [
            {"assigned_to": "ed"},
            {"assigned_to": "unknown_agent_1"},
            {"assigned_to": "unknown_agent_2"},
        ]

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=steps_data)

        mock_sb.table.return_value = select_chain

        # Only 1 known domain, should not escalate
        assert _should_escalate("mission-001") is False


# ---------------------------------------------------------------------------
# Model selection in execute_step
# ---------------------------------------------------------------------------


class TestModelSelection:
    """Test model selection logic in execute_step."""

    def _make_step(self, **overrides):
        step = {
            "id": "step-001",
            "mission_id": "mission-001",
            "description": "Implement file watcher",
            "assigned_to": "ed",
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
    @patch("engine.executor._should_escalate")
    def test_uses_worker_model_by_default(
        self, mock_escalate, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step
        from engine.config import WORKER_MODEL

        mock_escalate.return_value = False
        mock_load.return_value = "# SKILL"
        mock_spawn.return_value = ("output", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed")]
        )

        step = self._make_step()
        execute_step(step)

        # Should have called _spawn_claude with WORKER_MODEL
        call_kwargs = mock_spawn.call_args
        assert call_kwargs[1]["model"] == WORKER_MODEL or call_kwargs[0][1] == WORKER_MODEL

    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor._should_escalate")
    def test_escalates_to_opus_when_step_has_escalate_flag(
        self, mock_escalate, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step
        from engine.config import ORCHESTRATOR_MODEL

        mock_escalate.return_value = False  # auto-escalation not triggered
        mock_load.return_value = "# SKILL"
        mock_spawn.return_value = ("output", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed")]
        )

        step = self._make_step(escalate=True)
        execute_step(step)

        call_kwargs = mock_spawn.call_args
        assert call_kwargs[1]["model"] == ORCHESTRATOR_MODEL or call_kwargs[0][1] == ORCHESTRATOR_MODEL

    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor._should_escalate")
    def test_escalates_to_opus_when_multi_domain_mission(
        self, mock_escalate, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step
        from engine.config import ORCHESTRATOR_MODEL

        mock_escalate.return_value = True  # multi-domain auto-escalation
        mock_load.return_value = "# SKILL"
        mock_spawn.return_value = ("output", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed")]
        )

        step = self._make_step()
        execute_step(step)

        call_kwargs = mock_spawn.call_args
        assert call_kwargs[1]["model"] == ORCHESTRATOR_MODEL or call_kwargs[0][1] == ORCHESTRATOR_MODEL

    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor._should_escalate")
    def test_step_model_override_takes_precedence(
        self, mock_escalate, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent,
    ):
        from engine.executor import execute_step

        mock_escalate.return_value = False
        mock_load.return_value = "# SKILL"
        mock_spawn.return_value = ("output", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed")]
        )

        step = self._make_step(model="custom-model-123")
        execute_step(step)

        call_kwargs = mock_spawn.call_args
        assert call_kwargs[1]["model"] == "custom-model-123" or call_kwargs[0][1] == "custom-model-123"


# ---------------------------------------------------------------------------
# Atomic claim guard in execute_next
# ---------------------------------------------------------------------------


class TestAtomicClaim:
    """Test atomic claim guard prevents double-execution."""

    @patch("engine.executor.execute_step")
    @patch("engine.executor.supabase")
    def test_atomic_claim_succeeds(self, mock_sb, mock_exec):
        from engine.executor import execute_next

        queued_step = {
            "id": "step-099",
            "mission_id": "m-005",
            "description": "Build API",
            "assigned_to": "ed",
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

        # Update chain for atomic claim - succeeds (data returned)
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

    @patch("engine.executor.execute_step")
    @patch("engine.executor.supabase")
    def test_atomic_claim_fails_returns_none(self, mock_sb, mock_exec):
        """When another poller already claimed the step, claim_result.data is empty."""
        from engine.executor import execute_next

        queued_step = {
            "id": "step-099",
            "mission_id": "m-005",
            "description": "Build API",
            "assigned_to": "ed",
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

        # Update chain for atomic claim - FAILS (empty data = already claimed)
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

        result = execute_next()

        # Should return None because claim failed
        assert result is None
        # Should NOT call execute_step
        mock_exec.assert_not_called()

    @patch("engine.executor.execute_step")
    @patch("engine.executor.supabase")
    def test_atomic_claim_uses_eq_status_queued(self, mock_sb, mock_exec):
        """Verify the claim update includes .eq('status', 'queued') for atomicity."""
        from engine.executor import execute_next

        queued_step = {
            "id": "step-099",
            "mission_id": "m-005",
            "description": "Build API",
            "assigned_to": "ed",
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

        # Track the .eq() calls on the update chain
        eq_calls = []
        update_chain = MagicMock()
        update_chain.update.return_value = update_chain

        def track_eq(*args, **kwargs):
            eq_calls.append(args)
            return update_chain

        update_chain.eq.side_effect = track_eq
        update_chain.execute.return_value = MagicMock(data=[{**queued_step, "status": "running"}])

        call_count = [0]
        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router
        mock_exec.return_value = {**queued_step, "status": "completed"}

        execute_next()

        # Verify .eq was called with both ("id", step_id) AND ("status", "queued")
        eq_args_flat = [arg for call in eq_calls for arg in call]
        assert "status" in eq_args_flat
        assert "queued" in eq_args_flat


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


# ---------------------------------------------------------------------------
# Memory injection into agent prompts
# ---------------------------------------------------------------------------


class TestMemoryInjection:
    """Test that execute_step injects relevant memories into skill_md."""

    def _make_step(self, **overrides):
        """Create a step dict for testing."""
        step = {
            "id": "step-001",
            "mission_id": "mission-001",
            "description": "Implement file watcher",
            "assigned_to": "ed",
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

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor.get_relevant_memories")
    @patch("engine.executor.format_memories_section")
    def test_injects_memories_into_skill_md(
        self, mock_format, mock_get_mem, mock_load, mock_spawn,
        mock_sb, mock_emit, mock_check_mission, mock_update_agent,
        mock_extract,
    ):
        """When memories exist, they should be appended to skill_md before spawning Claude."""
        from engine.executor import execute_step

        mock_load.return_value = "# Ed SKILL\nDo engineering."
        mock_get_mem.return_value = [
            {"memory_type": "solution", "content": "Use async for file ops", "confidence": 0.9},
            {"memory_type": "warning", "content": "Avoid blocking IO", "confidence": 0.8},
        ]
        mock_format.return_value = "\n\n## Recent Memories\n- [solution] Use async for file ops (confidence: 0.9)\n- [warning] Avoid blocking IO (confidence: 0.8)"
        mock_spawn.return_value = ("Output from Claude", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", output="Output from Claude")]
        )
        mock_extract.return_value = []

        step = self._make_step()
        execute_step(step)

        # get_relevant_memories should be called with daimyo_id and description
        mock_get_mem.assert_called_once_with("ed", "Implement file watcher", limit=5)

        # format_memories_section should be called with the returned memories
        mock_format.assert_called_once_with(mock_get_mem.return_value)

        # _spawn_claude should receive skill_md WITH memories appended
        spawn_call = mock_spawn.call_args
        skill_arg = spawn_call[1].get("skill_md") or spawn_call[0][0]
        assert "# Ed SKILL" in skill_arg
        assert "## Recent Memories" in skill_arg
        assert "Use async for file ops" in skill_arg

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor.get_relevant_memories")
    @patch("engine.executor.format_memories_section")
    def test_no_memories_does_not_modify_skill_md(
        self, mock_format, mock_get_mem, mock_load, mock_spawn,
        mock_sb, mock_emit, mock_check_mission, mock_update_agent,
        mock_extract,
    ):
        """When no memories exist, skill_md should be passed unchanged."""
        from engine.executor import execute_step

        mock_load.return_value = "# Ed SKILL\nDo engineering."
        mock_get_mem.return_value = []
        mock_format.return_value = ""  # empty string when no memories
        mock_spawn.return_value = ("Output from Claude", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", output="Output from Claude")]
        )
        mock_extract.return_value = []

        step = self._make_step()
        execute_step(step)

        # _spawn_claude should receive original skill_md unchanged
        spawn_call = mock_spawn.call_args
        skill_arg = spawn_call[1].get("skill_md") or spawn_call[0][0]
        assert skill_arg == "# Ed SKILL\nDo engineering."

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor.get_relevant_memories")
    def test_memory_retrieval_failure_does_not_block_execution(
        self, mock_get_mem, mock_load, mock_spawn,
        mock_sb, mock_emit, mock_check_mission, mock_update_agent,
        mock_extract,
    ):
        """If get_relevant_memories raises, execution should continue normally."""
        from engine.executor import execute_step

        mock_load.return_value = "# Ed SKILL"
        mock_get_mem.side_effect = Exception("Supabase connection failed")
        mock_spawn.return_value = ("Output from Claude", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", output="Output from Claude")]
        )
        mock_extract.return_value = []

        step = self._make_step()
        result = execute_step(step)

        # Execution should still succeed
        assert result["status"] == "completed"
        # Claude should still be spawned (with original skill_md)
        mock_spawn.assert_called_once()

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor.get_relevant_memories")
    @patch("engine.executor.format_memories_section")
    def test_format_failure_does_not_block_execution(
        self, mock_format, mock_get_mem, mock_load, mock_spawn,
        mock_sb, mock_emit, mock_check_mission, mock_update_agent,
        mock_extract,
    ):
        """If format_memories_section raises, execution should continue normally."""
        from engine.executor import execute_step

        mock_load.return_value = "# Ed SKILL"
        mock_get_mem.return_value = [{"memory_type": "insight", "content": "test"}]
        mock_format.side_effect = Exception("Formatting blew up")
        mock_spawn.return_value = ("Output from Claude", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", output="Output from Claude")]
        )
        mock_extract.return_value = []

        step = self._make_step()
        result = execute_step(step)

        assert result["status"] == "completed"
        mock_spawn.assert_called_once()

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    @patch("engine.executor.get_relevant_memories")
    @patch("engine.executor.format_memories_section")
    def test_memory_injection_uses_correct_daimyo_id(
        self, mock_format, mock_get_mem, mock_load, mock_spawn,
        mock_sb, mock_emit, mock_check_mission, mock_update_agent,
        mock_extract,
    ):
        """Memory retrieval should use the step's assigned_to daimyo ID."""
        from engine.executor import execute_step

        mock_load.return_value = "# SKILL"
        mock_get_mem.return_value = []
        mock_format.return_value = ""
        mock_spawn.return_value = ("Done", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", assigned_to="light")]
        )
        mock_extract.return_value = []

        step = self._make_step(assigned_to="light", description="Design product roadmap")
        execute_step(step)

        mock_get_mem.assert_called_once_with("light", "Design product roadmap", limit=5)


# ---------------------------------------------------------------------------
# Drift integration in _check_mission_complete
# ---------------------------------------------------------------------------


class TestDriftInCheckMissionComplete:
    """Test that _check_mission_complete calls apply_drift after mission ends."""

    @patch("engine.executor.apply_drift")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    def test_calls_apply_drift_on_success(self, mock_sb, mock_emit, mock_drift):
        from engine.executor import _check_mission_complete

        # Count query: no remaining non-terminal steps
        count_response = MagicMock()
        count_response.count = 0

        # Failed count: 0 (success)
        failed_response = MagicMock()
        failed_response.count = 0

        # Steps query for drift: 2 unique daimyo
        steps_data = [
            {"daimyo": "ed"},
            {"daimyo": "light"},
            {"daimyo": "ed"},  # duplicate, should be deduped
        ]
        steps_response = MagicMock(data=steps_data)

        def make_chain():
            c = MagicMock()
            c.select.return_value = c
            c.eq.return_value = c
            c.not_.return_value = c
            c.in_.return_value = c
            c.update.return_value = c
            c.execute.return_value = MagicMock(data=[], count=0)
            return c

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            chain = make_chain()
            if call_count[0] == 1:
                # Non-terminal steps count
                chain.execute.return_value = count_response
            elif call_count[0] == 2:
                # Failed steps count
                chain.execute.return_value = failed_response
            elif call_count[0] == 3:
                # Mission update (success)
                chain.execute.return_value = MagicMock(data=[{"id": "m-001", "status": "completed"}])
            elif call_count[0] == 4:
                # _update_linked_task: mission query
                chain.execute.return_value = MagicMock(data=[{"proposal_id": None}])
            elif call_count[0] == 5:
                # Steps query for drift daimyo
                chain.execute.return_value = steps_response
            return chain

        mock_sb.table.side_effect = table_router

        _check_mission_complete("m-001")

        # apply_drift should be called with pairs and success=True
        mock_drift.assert_called_once()
        drift_args = mock_drift.call_args
        pairs = drift_args[0][0]
        success = drift_args[1].get("success") if drift_args[1] else drift_args[0][1]
        assert success is True
        # Should have 1 pair: (ed, light)
        assert len(pairs) == 1

    @patch("engine.executor.apply_drift")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    def test_drift_is_best_effort(self, mock_sb, mock_emit, mock_drift):
        """apply_drift failure should not crash _check_mission_complete."""
        from engine.executor import _check_mission_complete

        count_response = MagicMock()
        count_response.count = 0

        failed_response = MagicMock()
        failed_response.count = 0

        def make_chain():
            c = MagicMock()
            c.select.return_value = c
            c.eq.return_value = c
            c.not_.return_value = c
            c.in_.return_value = c
            c.update.return_value = c
            c.execute.return_value = MagicMock(data=[], count=0)
            return c

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            chain = make_chain()
            if call_count[0] == 1:
                chain.execute.return_value = count_response
            elif call_count[0] == 2:
                chain.execute.return_value = failed_response
            elif call_count[0] == 3:
                chain.execute.return_value = MagicMock(data=[{"id": "m-001", "status": "completed"}])
            elif call_count[0] == 4:
                chain.execute.return_value = MagicMock(data=[{"proposal_id": None}])
            elif call_count[0] == 5:
                # Steps query for drift — raise exception
                raise Exception("DB timeout")
            return chain

        mock_sb.table.side_effect = table_router

        # Should not raise
        _check_mission_complete("m-001")
