"""Tests for engine.events — Event emitter for Shogunate Engine."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# emit() — table name and column mapping
# ---------------------------------------------------------------------------


class TestEmitTableName:
    """Verify emit() writes to the correct Supabase table."""

    @patch("engine.events.supabase")
    def test_writes_to_war_room_events_table(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "evt-1", "event_type": "step_completed"}]
        )

        emit("step_completed", {"agent": "ed", "message": "Done"})

        mock_sb.table.assert_called_once_with("war_room_events")

    @patch("engine.events.supabase")
    def test_does_not_write_to_ops_agent_events(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "evt-1"}]
        )

        emit("step_completed", {"agent": "ed"})

        table_arg = mock_sb.table.call_args[0][0]
        assert table_arg != "ops_agent_events"


class TestEmitColumnMapping:
    """Verify emit() maps payload to war_room_events columns correctly."""

    @patch("engine.events.supabase")
    def test_agent_id_from_agent_key(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"agent": "ed", "message": "Done"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["agent_id"] == "ed"

    @patch("engine.events.supabase")
    def test_agent_id_from_assigned_to_key(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"assigned_to": "light", "message": "Reviewed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["agent_id"] == "light"

    @patch("engine.events.supabase")
    def test_agent_id_from_daimyo_key(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("mission_started", {"daimyo": "toji"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["agent_id"] == "toji"

    @patch("engine.events.supabase")
    def test_agent_id_defaults_to_system(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("system_event", {"message": "No agent info"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["agent_id"] == "system"

    @patch("engine.events.supabase")
    def test_agent_id_priority_order(self, mock_sb):
        """agent takes priority over assigned_to which takes priority over daimyo."""
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("test", {"agent": "ed", "assigned_to": "light", "daimyo": "toji"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["agent_id"] == "ed"

    @patch("engine.events.supabase")
    def test_title_from_payload(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"title": "Custom Title", "agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["title"] == "Custom Title"

    @patch("engine.events.supabase")
    def test_title_defaults_from_event_type(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["title"] == "Step Completed"

    @patch("engine.events.supabase")
    def test_description_from_message_key(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"message": "Task finished", "agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["description"] == "Task finished"

    @patch("engine.events.supabase")
    def test_description_from_description_key(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"description": "Desc text", "agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["description"] == "Desc text"

    @patch("engine.events.supabase")
    def test_description_from_error_key(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_failed", {"error": "Timeout occurred", "agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["description"] == "Timeout occurred"

    @patch("engine.events.supabase")
    def test_description_defaults_to_empty_string(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["description"] == ""

    @patch("engine.events.supabase")
    def test_metadata_contains_full_payload(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        payload = {"agent": "ed", "message": "Done", "extra_field": 42}
        emit("step_completed", payload)

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["metadata"] == payload

    @patch("engine.events.supabase")
    def test_no_payload_column_in_insert(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert "payload" not in insert_arg

    @patch("engine.events.supabase")
    def test_event_type_preserved(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("mission_completed", {"agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["event_type"] == "mission_completed"

    @patch("engine.events.supabase")
    def test_created_at_is_iso_utc(self, mock_sb):
        from engine.events import emit

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        emit("step_completed", {"agent": "ed"})

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert "created_at" in insert_arg
        # Should parse as valid ISO datetime
        dt = datetime.fromisoformat(insert_arg["created_at"])
        assert dt.tzinfo is not None


class TestEmitWithoutSupabase:
    """Verify emit() behavior when Supabase is not configured."""

    @patch("engine.events.supabase", None)
    def test_returns_event_dict_when_supabase_unavailable(self):
        from engine.events import emit

        result = emit("test_event", {"agent": "ed", "message": "Hello"})

        assert result["event_type"] == "test_event"
        assert result["agent_id"] == "ed"
        assert result["metadata"] == {"agent": "ed", "message": "Hello"}
        assert "payload" not in result


class TestEmitDocstring:
    """Verify the docstring references the correct table name."""

    def test_docstring_mentions_war_room_events(self):
        from engine.events import emit

        assert "war_room_events" in emit.__doc__
        assert "ops_agent_events" not in emit.__doc__
