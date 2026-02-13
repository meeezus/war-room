"""Tests for engine.memory — Memory extraction and retrieval for Shogunate Engine."""

import json
import subprocess
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# extract_and_store
# ---------------------------------------------------------------------------


class TestExtractAndStore:
    """Test memory extraction from step output."""

    def _make_step(self, **overrides):
        """Create a step dict for testing."""
        step = {
            "id": "step-001",
            "mission_id": "mission-001",
            "title": "Implement file watcher",
            "description": "Build file watcher for engine",
            "assigned_to": "ed",
            "daimyo": "ed",
            "status": "completed",
        }
        step.update(overrides)
        return step

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_extracts_and_stores_memories(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        # Claude returns valid JSON with learnings
        extraction_result = json.dumps([
            {
                "memory_type": "solution",
                "content": "Fixed auth by adding null check",
                "tags": ["auth", "null-check"],
                "confidence": 0.85,
            }
        ])
        mock_run.return_value = MagicMock(
            stdout=extraction_result,
            stderr="",
            returncode=0,
        )

        # Supabase insert returns the stored memory
        stored_memory = {
            "id": "mem-001",
            "agent_id": "ed",
            "memory_type": "solution",
            "content": "Fixed auth by adding null check",
            "tags": ["auth", "null-check"],
            "confidence": 0.85,
            "source_mission_id": "mission-001",
            "status": "active",
        }
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[stored_memory]
        )

        step = self._make_step()
        result = extract_and_store(step, "Some step output with learnings")

        assert len(result) == 1
        assert result[0]["memory_type"] == "solution"
        assert result[0]["content"] == "Fixed auth by adding null check"

        # Verify subprocess was called with claude
        mock_run.assert_called_once()
        call_args = mock_run.call_args
        assert call_args[0][0][0] == "claude"
        assert call_args[0][0][1] == "-p"

        # Verify supabase insert was called
        mock_sb.table.assert_called_with("agent_memory")

    @patch("engine.memory.supabase", None)
    def test_returns_empty_when_no_supabase(self):
        from engine.memory import extract_and_store

        step = self._make_step()
        result = extract_and_store(step, "Some output")
        assert result == []

    @patch("engine.memory.supabase")
    def test_returns_empty_when_no_output(self, mock_sb):
        from engine.memory import extract_and_store

        step = self._make_step()
        assert extract_and_store(step, "") == []
        assert extract_and_store(step, None) == []

    @patch("engine.memory.supabase")
    def test_returns_empty_when_whitespace_only_output(self, mock_sb):
        from engine.memory import extract_and_store

        step = self._make_step()
        assert extract_and_store(step, "   \n  ") == []

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_handles_claude_timeout(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        mock_run.side_effect = subprocess.TimeoutExpired(cmd=["claude"], timeout=60)

        step = self._make_step()
        result = extract_and_store(step, "Some output")
        assert result == []

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_handles_claude_not_found(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        mock_run.side_effect = FileNotFoundError("claude not found")

        step = self._make_step()
        result = extract_and_store(step, "Some output")
        assert result == []

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_handles_nonzero_exit_code(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        mock_run.return_value = MagicMock(stdout="", stderr="Error", returncode=1)

        step = self._make_step()
        result = extract_and_store(step, "Some output")
        assert result == []

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_handles_invalid_json_response(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        mock_run.return_value = MagicMock(
            stdout="This is not JSON at all",
            stderr="",
            returncode=0,
        )

        step = self._make_step()
        result = extract_and_store(step, "Some output")
        assert result == []

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_handles_json_wrapped_in_code_block(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        extraction_result = '```json\n[{"memory_type": "insight", "content": "Learned something", "tags": ["test"], "confidence": 0.7}]\n```'
        mock_run.return_value = MagicMock(
            stdout=extraction_result,
            stderr="",
            returncode=0,
        )

        stored_memory = {
            "id": "mem-002",
            "agent_id": "ed",
            "memory_type": "insight",
            "content": "Learned something",
            "tags": ["test"],
            "confidence": 0.7,
            "source_mission_id": "mission-001",
            "status": "active",
        }
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[stored_memory]
        )

        step = self._make_step()
        result = extract_and_store(step, "Some output")

        assert len(result) == 1
        assert result[0]["content"] == "Learned something"

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_caps_at_three_memories(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        # Return 5 memories from Claude
        memories = [
            {"memory_type": "insight", "content": f"Learning {i}", "tags": ["test"], "confidence": 0.5}
            for i in range(5)
        ]
        mock_run.return_value = MagicMock(
            stdout=json.dumps(memories),
            stderr="",
            returncode=0,
        )

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": f"mem-{i}"} for i in range(1)]
        )

        step = self._make_step()
        result = extract_and_store(step, "Some output")

        # Should only attempt 3 inserts (capped)
        assert mock_sb.table.return_value.insert.call_count == 3

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_clamps_confidence_to_valid_range(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        memories = [
            {"memory_type": "insight", "content": "Over confident", "tags": ["test"], "confidence": 1.5},
            {"memory_type": "insight", "content": "Under confident", "tags": ["test"], "confidence": -0.3},
        ]
        mock_run.return_value = MagicMock(
            stdout=json.dumps(memories),
            stderr="",
            returncode=0,
        )

        inserted_data = []
        def capture_insert(data):
            inserted_data.append(data)
            mock_result = MagicMock()
            mock_result.execute.return_value = MagicMock(data=[{**data, "id": "mem-x"}])
            return mock_result

        mock_sb.table.return_value.insert.side_effect = capture_insert

        step = self._make_step()
        extract_and_store(step, "Some output")

        # First memory: confidence 1.5 should be clamped to 1.0
        assert inserted_data[0]["confidence"] == 1.0
        # Second memory: confidence -0.3 should be clamped to 0.0
        assert inserted_data[1]["confidence"] == 0.0

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_uses_daimyo_field_first(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        memories = [{"memory_type": "insight", "content": "Test", "tags": [], "confidence": 0.5}]
        mock_run.return_value = MagicMock(
            stdout=json.dumps(memories), stderr="", returncode=0,
        )

        inserted_data = []
        def capture_insert(data):
            inserted_data.append(data)
            mock_result = MagicMock()
            mock_result.execute.return_value = MagicMock(data=[{**data, "id": "mem-x"}])
            return mock_result

        mock_sb.table.return_value.insert.side_effect = capture_insert

        step = self._make_step(daimyo="light", assigned_to="ed")
        extract_and_store(step, "Some output")

        assert inserted_data[0]["agent_id"] == "light"

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_falls_back_to_assigned_to(self, mock_sb, mock_run):
        from engine.memory import extract_and_store

        memories = [{"memory_type": "insight", "content": "Test", "tags": [], "confidence": 0.5}]
        mock_run.return_value = MagicMock(
            stdout=json.dumps(memories), stderr="", returncode=0,
        )

        inserted_data = []
        def capture_insert(data):
            inserted_data.append(data)
            mock_result = MagicMock()
            mock_result.execute.return_value = MagicMock(data=[{**data, "id": "mem-x"}])
            return mock_result

        mock_sb.table.return_value.insert.side_effect = capture_insert

        # Step has no daimyo key, only assigned_to
        step = {"id": "s1", "mission_id": "m1", "title": "Test", "assigned_to": "toji"}
        extract_and_store(step, "Some output")

        assert inserted_data[0]["agent_id"] == "toji"

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_supabase_insert_failure_continues(self, mock_sb, mock_run):
        """If one memory insert fails, the others should still be attempted."""
        from engine.memory import extract_and_store

        memories = [
            {"memory_type": "insight", "content": "Learning 1", "tags": [], "confidence": 0.5},
            {"memory_type": "insight", "content": "Learning 2", "tags": [], "confidence": 0.6},
        ]
        mock_run.return_value = MagicMock(
            stdout=json.dumps(memories), stderr="", returncode=0,
        )

        call_count = [0]
        def insert_side_effect(data):
            call_count[0] += 1
            if call_count[0] == 1:
                raise Exception("Insert failed")
            mock_result = MagicMock()
            mock_result.execute.return_value = MagicMock(data=[{**data, "id": "mem-002"}])
            return mock_result

        mock_sb.table.return_value.insert.side_effect = insert_side_effect

        step = self._make_step()
        result = extract_and_store(step, "Some output")

        # First insert failed, second succeeded
        assert len(result) == 1

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_handles_non_list_json_response(self, mock_sb, mock_run):
        """If Claude returns a dict instead of a list, should return empty."""
        from engine.memory import extract_and_store

        mock_run.return_value = MagicMock(
            stdout='{"memory_type": "insight", "content": "Single"}',
            stderr="",
            returncode=0,
        )

        step = self._make_step()
        result = extract_and_store(step, "Some output")
        assert result == []

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_uses_cheap_model(self, mock_sb, mock_run):
        """Should use CHEAP_MODEL for extraction."""
        from engine.memory import extract_and_store

        mock_run.return_value = MagicMock(
            stdout="[]", stderr="", returncode=0,
        )

        step = self._make_step()
        extract_and_store(step, "Some output")

        # Check that --model was passed with CHEAP_MODEL
        call_args = mock_run.call_args[0][0]
        model_idx = call_args.index("--model")
        from engine.config import CHEAP_MODEL
        assert call_args[model_idx + 1] == CHEAP_MODEL

    @patch("engine.memory.subprocess.run")
    @patch("engine.memory.supabase")
    def test_truncates_output_in_prompt(self, mock_sb, mock_run):
        """Output passed to Claude should be truncated to 3000 chars."""
        from engine.memory import extract_and_store

        mock_run.return_value = MagicMock(
            stdout="[]", stderr="", returncode=0,
        )

        long_output = "x" * 5000
        step = self._make_step()
        extract_and_store(step, long_output)

        # The prompt (last positional arg to claude -p) should contain truncated output
        call_args = mock_run.call_args[0][0]
        prompt = call_args[-1]  # Last arg is the prompt
        assert "x" * 3000 in prompt
        assert "x" * 5000 not in prompt


# ---------------------------------------------------------------------------
# get_relevant_memories
# ---------------------------------------------------------------------------


class TestGetRelevantMemories:
    """Test memory retrieval for agents."""

    @patch("engine.memory.supabase")
    def test_returns_memories_for_agent(self, mock_sb):
        from engine.memory import get_relevant_memories

        memories = [
            {"id": "m1", "agent_id": "ed", "content": "Learning 1", "confidence": 0.9},
            {"id": "m2", "agent_id": "ed", "content": "Learning 2", "confidence": 0.7},
        ]

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=memories)
        mock_sb.table.return_value = chain

        result = get_relevant_memories("ed")

        assert len(result) == 2
        assert result[0]["content"] == "Learning 1"
        mock_sb.table.assert_called_with("agent_memory")

    @patch("engine.memory.supabase")
    def test_filters_by_agent_id_and_active_status(self, mock_sb):
        from engine.memory import get_relevant_memories

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        get_relevant_memories("light")

        # Check .eq was called with both agent_id and status
        eq_calls = chain.eq.call_args_list
        eq_args = [(c[0][0], c[0][1]) for c in eq_calls]
        assert ("agent_id", "light") in eq_args
        assert ("status", "active") in eq_args

    @patch("engine.memory.supabase")
    def test_respects_limit_parameter(self, mock_sb):
        from engine.memory import get_relevant_memories

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        get_relevant_memories("ed", limit=10)

        chain.limit.assert_called_with(10)

    @patch("engine.memory.supabase")
    def test_default_limit_is_five(self, mock_sb):
        from engine.memory import get_relevant_memories

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        get_relevant_memories("ed")

        chain.limit.assert_called_with(5)

    @patch("engine.memory.supabase", None)
    def test_returns_empty_when_no_supabase(self):
        from engine.memory import get_relevant_memories

        result = get_relevant_memories("ed")
        assert result == []

    @patch("engine.memory.supabase")
    def test_handles_query_exception(self, mock_sb):
        from engine.memory import get_relevant_memories

        mock_sb.table.side_effect = Exception("Connection error")

        result = get_relevant_memories("ed")
        assert result == []

    @patch("engine.memory.supabase")
    def test_returns_empty_list_when_no_data(self, mock_sb):
        from engine.memory import get_relevant_memories

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=None)
        mock_sb.table.return_value = chain

        result = get_relevant_memories("ed")
        assert result == []


# ---------------------------------------------------------------------------
# format_memories_section
# ---------------------------------------------------------------------------


class TestFormatMemoriesSection:
    """Test formatting memories as markdown for prompt injection."""

    def test_formats_memories_as_markdown(self):
        from engine.memory import format_memories_section

        memories = [
            {"memory_type": "solution", "content": "Fixed auth with null check", "confidence": 0.85},
            {"memory_type": "warning", "content": "Avoid direct DB writes", "confidence": 0.7},
        ]

        result = format_memories_section(memories)

        assert "## Recent Memories" in result
        assert "[solution] Fixed auth with null check (confidence: 0.9)" in result or \
               "[solution] Fixed auth with null check (confidence: 0.8)" in result
        assert "[warning] Avoid direct DB writes" in result

    def test_returns_empty_string_for_no_memories(self):
        from engine.memory import format_memories_section

        assert format_memories_section([]) == ""
        assert format_memories_section(None) == ""

    def test_includes_confidence_scores(self):
        from engine.memory import format_memories_section

        memories = [
            {"memory_type": "insight", "content": "Test content", "confidence": 0.92},
        ]

        result = format_memories_section(memories)
        assert "(confidence: 0.9)" in result

    def test_handles_missing_fields_gracefully(self):
        from engine.memory import format_memories_section

        memories = [
            {"content": "No type field"},  # missing memory_type and confidence
        ]

        result = format_memories_section(memories)
        assert "No type field" in result
        # Should default memory_type to "insight" and confidence to 0.5
        assert "[insight]" in result


# ---------------------------------------------------------------------------
# Integration: executor calls extract_and_store
# ---------------------------------------------------------------------------


class TestExecutorMemoryIntegration:
    """Test that executor.py calls extract_and_store after step completion."""

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

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_calls_extract_and_store_on_success(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent, mock_extract,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# SKILL"
        mock_spawn.return_value = ("Output from Claude", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", output="Output from Claude")]
        )
        mock_extract.return_value = []

        step = self._make_step()
        execute_step(step)

        mock_extract.assert_called_once_with(step, "Output from Claude")

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_does_not_call_extract_on_failure(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent, mock_extract,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# SKILL"
        mock_spawn.return_value = ("", "Error: crash", 1)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="failed", error="Error: crash")]
        )

        step = self._make_step()
        execute_step(step)

        mock_extract.assert_not_called()

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_extract_failure_does_not_block_execution(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent, mock_extract,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# SKILL"
        mock_spawn.return_value = ("Output from Claude", "", 0)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="completed", output="Output from Claude")]
        )
        mock_extract.side_effect = Exception("Memory extraction exploded")

        step = self._make_step()
        result = execute_step(step)

        # Execution should still complete successfully
        assert result["status"] == "completed"
        # Mission check and agent update should still happen
        mock_check_mission.assert_called_once()
        mock_update_agent.assert_called_once()

    @patch("engine.executor.extract_and_store")
    @patch("engine.executor._update_agent_status")
    @patch("engine.executor._check_mission_complete")
    @patch("engine.executor.emit")
    @patch("engine.executor.supabase")
    @patch("engine.executor._spawn_claude")
    @patch("engine.executor._load_skill_md")
    def test_does_not_call_extract_on_timeout(
        self, mock_load, mock_spawn, mock_sb, mock_emit,
        mock_check_mission, mock_update_agent, mock_extract,
    ):
        from engine.executor import execute_step

        mock_load.return_value = "# SKILL"
        mock_spawn.side_effect = subprocess.TimeoutExpired(cmd=["claude"], timeout=1800)
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[self._make_step(status="failed")]
        )

        step = self._make_step()
        execute_step(step)

        mock_extract.assert_not_called()
