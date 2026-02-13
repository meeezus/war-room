"""Tests for engine.poller — 10s polling daemon for Shogunate Engine."""

import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# State persistence: load_state / save_state
# ---------------------------------------------------------------------------


class TestLoadState:
    """Test loading poller state from disk."""

    def test_returns_empty_dict_when_no_file(self, tmp_path):
        state_file = str(tmp_path / "nonexistent.json")
        with patch("engine.poller.STATE_FILE", state_file):
            from engine.poller import load_state
            result = load_state()
            assert result == {}

    def test_loads_existing_state(self, tmp_path):
        state_file = tmp_path / "state.json"
        state_file.write_text(json.dumps({"last_run": "2025-01-01T00:00:00", "steps_processed": 5}))
        with patch("engine.poller.STATE_FILE", str(state_file)):
            from engine.poller import load_state
            result = load_state()
            assert result["last_run"] == "2025-01-01T00:00:00"
            assert result["steps_processed"] == 5

    def test_returns_empty_dict_on_corrupt_json(self, tmp_path):
        state_file = tmp_path / "state.json"
        state_file.write_text("not valid json {{{")
        with patch("engine.poller.STATE_FILE", str(state_file)):
            from engine.poller import load_state
            result = load_state()
            assert result == {}


class TestSaveState:
    """Test persisting poller state to disk."""

    def test_saves_state_to_file(self, tmp_path):
        state_file = str(tmp_path / "state.json")
        with patch("engine.poller.STATE_FILE", state_file):
            from engine.poller import save_state
            save_state({"last_run": "2025-01-01", "steps_processed": 3})
            loaded = json.loads(Path(state_file).read_text())
            assert loaded["last_run"] == "2025-01-01"
            assert loaded["steps_processed"] == 3

    def test_creates_parent_directories(self, tmp_path):
        state_file = str(tmp_path / "subdir" / "deep" / "state.json")
        with patch("engine.poller.STATE_FILE", state_file):
            from engine.poller import save_state
            save_state({"test": True})
            assert Path(state_file).exists()
            loaded = json.loads(Path(state_file).read_text())
            assert loaded["test"] is True


# ---------------------------------------------------------------------------
# detect_stale_steps
# ---------------------------------------------------------------------------


class TestDetectStaleSteps:
    """Test stale step detection and cleanup."""

    @patch("engine.poller.emit")
    @patch("engine.poller.supabase")
    def test_marks_timed_out_step_as_failed(self, mock_sb, mock_emit):
        from engine.poller import detect_stale_steps

        # A step started 60 minutes ago with 30-minute timeout
        started_at = (datetime.now(timezone.utc) - timedelta(minutes=60)).isoformat()
        running_steps = [
            {
                "id": "step-stale-1",
                "started_at": started_at,
                "timeout_minutes": 30,
                "mission_id": "m-001",
            }
        ]

        # SELECT chain for finding running steps
        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=running_steps)

        # UPDATE chain for marking as failed
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

        count = detect_stale_steps()

        assert count == 1
        # Should have called update with status=failed
        update_chain.update.assert_called_once()
        update_args = update_chain.update.call_args[0][0]
        assert update_args["status"] == "failed"
        assert "timed out" in update_args["error"]

        # Should emit step_stale event
        mock_emit.assert_called_once()
        assert mock_emit.call_args[0][0] == "step_stale"

    @patch("engine.poller.emit")
    @patch("engine.poller.supabase")
    def test_ignores_non_stale_running_step(self, mock_sb, mock_emit):
        from engine.poller import detect_stale_steps

        # A step started 5 minutes ago with 30-minute timeout — not stale
        started_at = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        running_steps = [
            {
                "id": "step-fresh-1",
                "started_at": started_at,
                "timeout_minutes": 30,
                "mission_id": "m-001",
            }
        ]

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=running_steps)

        mock_sb.table.return_value = select_chain

        count = detect_stale_steps()

        assert count == 0
        mock_emit.assert_not_called()

    @patch("engine.poller.supabase", None)
    def test_returns_zero_when_no_supabase(self):
        from engine.poller import detect_stale_steps
        count = detect_stale_steps()
        assert count == 0

    @patch("engine.poller.emit")
    @patch("engine.poller.supabase")
    def test_returns_zero_when_no_running_steps(self, mock_sb, mock_emit):
        from engine.poller import detect_stale_steps

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = select_chain

        count = detect_stale_steps()
        assert count == 0

    @patch("engine.poller.emit")
    @patch("engine.poller.supabase")
    def test_uses_default_timeout_when_step_has_none(self, mock_sb, mock_emit):
        from engine.poller import detect_stale_steps
        from engine.config import DEFAULT_TIMEOUT_MINUTES

        # Step started well beyond default timeout, but has no timeout_minutes field
        started_at = (datetime.now(timezone.utc) - timedelta(minutes=DEFAULT_TIMEOUT_MINUTES + 10)).isoformat()
        running_steps = [
            {
                "id": "step-no-timeout",
                "started_at": started_at,
                "timeout_minutes": None,
                "mission_id": "m-002",
            }
        ]

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=running_steps)

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

        count = detect_stale_steps()
        assert count == 1

    @patch("engine.poller.emit")
    @patch("engine.poller.supabase")
    def test_skips_step_with_no_started_at(self, mock_sb, mock_emit):
        from engine.poller import detect_stale_steps

        running_steps = [
            {
                "id": "step-no-start",
                "started_at": None,
                "timeout_minutes": 30,
                "mission_id": "m-003",
            }
        ]

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=running_steps)

        mock_sb.table.return_value = select_chain

        count = detect_stale_steps()
        assert count == 0


# ---------------------------------------------------------------------------
# poll_cycle
# ---------------------------------------------------------------------------


class TestPollCycle:
    """Test a single poll cycle."""

    @patch("engine.poller.emit")
    @patch("engine.poller.detect_stale_steps")
    @patch("engine.poller.execute_next")
    @patch("engine.poller.run_pending")
    def test_successful_cycle_updates_state(self, mock_run_pending, mock_execute, mock_stale, mock_emit):
        from engine.poller import poll_cycle

        mock_run_pending.return_value = []
        mock_execute.return_value = None
        mock_stale.return_value = 0

        state = {"steps_processed": 0, "consecutive_errors": 3}
        new_state = poll_cycle(state)

        assert new_state["consecutive_errors"] == 0  # Reset on success
        assert "last_run" in new_state
        mock_run_pending.assert_called_once()
        mock_execute.assert_called_once()
        mock_stale.assert_called_once()

    @patch("engine.poller.emit")
    @patch("engine.poller.detect_stale_steps")
    @patch("engine.poller.execute_next")
    @patch("engine.poller.run_pending")
    def test_increments_steps_processed_on_execution(self, mock_run_pending, mock_execute, mock_stale, mock_emit):
        from engine.poller import poll_cycle

        mock_run_pending.return_value = []
        mock_execute.return_value = {"id": "step-1", "status": "completed", "title": "Test step"}
        mock_stale.return_value = 0

        state = {"steps_processed": 5}
        new_state = poll_cycle(state)

        assert new_state["steps_processed"] == 6

    @patch("engine.poller.emit")
    @patch("engine.poller.detect_stale_steps")
    @patch("engine.poller.execute_next")
    @patch("engine.poller.run_pending")
    def test_does_not_increment_when_no_step_executed(self, mock_run_pending, mock_execute, mock_stale, mock_emit):
        from engine.poller import poll_cycle

        mock_run_pending.return_value = []
        mock_execute.return_value = None  # No queued step
        mock_stale.return_value = 0

        state = {"steps_processed": 5}
        new_state = poll_cycle(state)

        assert new_state["steps_processed"] == 5

    @patch("engine.poller.emit")
    @patch("engine.poller.detect_stale_steps")
    @patch("engine.poller.execute_next")
    @patch("engine.poller.run_pending")
    def test_emits_heartbeat(self, mock_run_pending, mock_execute, mock_stale, mock_emit):
        from engine.poller import poll_cycle

        mock_run_pending.return_value = [{"title": "New Mission", "assigned_to": "ed"}]
        mock_execute.return_value = {"id": "step-1", "status": "completed"}
        mock_stale.return_value = 2

        state = {}
        poll_cycle(state)

        # Should emit heartbeat event
        mock_emit.assert_called_once()
        args = mock_emit.call_args
        assert args[0][0] == "heartbeat"
        payload = args[0][1]
        assert payload["agent"] == "poller"
        assert payload["new_missions"] == 1
        assert payload["step_executed"] is True
        assert payload["stale_detected"] == 2

    @patch("engine.poller.emit")
    @patch("engine.poller.detect_stale_steps")
    @patch("engine.poller.execute_next")
    @patch("engine.poller.run_pending")
    def test_handles_run_pending_error_gracefully(self, mock_run_pending, mock_execute, mock_stale, mock_emit):
        from engine.poller import poll_cycle

        mock_run_pending.side_effect = Exception("DB connection lost")
        mock_execute.return_value = None
        mock_stale.return_value = 0

        state = {}
        # Should not raise — errors are caught per-task
        new_state = poll_cycle(state)
        assert "last_run" in new_state

    @patch("engine.poller.emit")
    @patch("engine.poller.detect_stale_steps")
    @patch("engine.poller.execute_next")
    @patch("engine.poller.run_pending")
    def test_handles_execute_next_error_gracefully(self, mock_run_pending, mock_execute, mock_stale, mock_emit):
        from engine.poller import poll_cycle

        mock_run_pending.return_value = []
        mock_execute.side_effect = Exception("Step runner crashed")
        mock_stale.return_value = 0

        state = {}
        new_state = poll_cycle(state)
        assert "last_run" in new_state

    @patch("engine.poller.emit")
    @patch("engine.poller.detect_stale_steps")
    @patch("engine.poller.execute_next")
    @patch("engine.poller.run_pending")
    def test_handles_stale_detection_error_gracefully(self, mock_run_pending, mock_execute, mock_stale, mock_emit):
        from engine.poller import poll_cycle

        mock_run_pending.return_value = []
        mock_execute.return_value = None
        mock_stale.side_effect = Exception("Query failed")

        state = {}
        new_state = poll_cycle(state)
        assert "last_run" in new_state


# ---------------------------------------------------------------------------
# main loop behavior
# ---------------------------------------------------------------------------


class TestMainLoop:
    """Test main loop startup and shutdown."""

    @patch("engine.poller.supabase", None)
    def test_exits_when_no_supabase(self):
        from engine.poller import main
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1

    @patch("engine.poller.save_state")
    @patch("engine.poller.poll_cycle")
    @patch("engine.poller.load_state")
    @patch("engine.poller.time")
    @patch("engine.poller.supabase", MagicMock())
    def test_loop_calls_poll_cycle(self, mock_time, mock_load, mock_poll, mock_save):
        from engine.poller import main

        mock_load.return_value = {}

        # Make poll_cycle run once then raise KeyboardInterrupt to exit
        iteration = [0]
        def poll_side_effect(state):
            iteration[0] += 1
            if iteration[0] >= 2:
                raise KeyboardInterrupt()
            return state

        mock_poll.side_effect = poll_side_effect
        mock_time.sleep = MagicMock()

        main()

        # poll_cycle was called
        assert mock_poll.call_count >= 1

    @patch("engine.poller.save_state")
    @patch("engine.poller.poll_cycle")
    @patch("engine.poller.load_state")
    @patch("engine.poller.time")
    @patch("engine.poller.supabase", MagicMock())
    def test_backoff_on_consecutive_errors(self, mock_time, mock_load, mock_poll, mock_save):
        from engine.poller import main, POLL_INTERVAL

        mock_load.return_value = {}

        # Simulate 6 consecutive errors then KeyboardInterrupt
        iteration = [0]
        def poll_side_effect(state):
            iteration[0] += 1
            state["consecutive_errors"] = state.get("consecutive_errors", 0) + 1
            if iteration[0] >= 7:
                raise KeyboardInterrupt()
            raise Exception("Persistent error")

        mock_poll.side_effect = poll_side_effect

        main()

        # After 5 consecutive errors, should sleep(60) for backoff
        sleep_calls = [c[0][0] for c in mock_time.sleep.call_args_list]
        assert 60 in sleep_calls


# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------


class TestPollerConstants:
    """Test module configuration."""

    def test_default_poll_interval(self):
        from engine.poller import POLL_INTERVAL
        assert POLL_INTERVAL == 10  # Default 10 seconds

    def test_state_file_path(self):
        from engine.poller import STATE_FILE
        assert "warroom" in STATE_FILE
        assert "poller_state.json" in STATE_FILE
