"""Tests for engine.proposal — Proposal CRUD for Shogunate Engine."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# create_proposal — insert + event emission
# ---------------------------------------------------------------------------


class TestCreateProposal:
    """Verify create_proposal() inserts into proposals table and emits event."""

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_inserts_into_proposals_table(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug", "engineering")

        mock_sb.table.assert_called_once_with("proposals")

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_insert_data_contains_required_fields(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug", "engineering")

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["title"] == "Fix auth"
        assert insert_arg["description"] == "Fix the login bug"
        assert insert_arg["domain"] == "engineering"
        assert insert_arg["status"] == "pending"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_default_requested_by_is_sensei(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug")

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["requested_by"] == "Sensei"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_custom_requested_by(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug", requested_by="Pip")

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["requested_by"] == "Pip"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_project_id_included_when_provided(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug", project_id="proj-123")

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["project_id"] == "proj-123"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_project_id_none_by_default(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug")

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["project_id"] is None

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_source_defaults_to_manual(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug")

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["source"] == "manual"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_source_custom_value(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug", source="discord")

        insert_arg = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_arg["source"] == "discord"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_returns_created_proposal(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        expected = {"id": "prop-1", "title": "Fix auth", "status": "pending"}
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[expected]
        )

        result = create_proposal("Fix auth", "Fix the login bug")

        assert result == expected

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_emits_proposal_created_event(self, mock_sb, mock_emit):
        from engine.proposal import create_proposal

        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "title": "Fix auth", "status": "pending"}]
        )

        create_proposal("Fix auth", "Fix the login bug", "engineering")

        mock_emit.assert_called_once()
        event_type = mock_emit.call_args[0][0]
        event_payload = mock_emit.call_args[0][1]
        assert event_type == "proposal_created"
        assert event_payload["proposal_id"] == "prop-1"
        assert event_payload["title"] == "Fix auth"
        assert event_payload["domain"] == "engineering"

    @patch("engine.proposal.supabase", None)
    def test_raises_runtime_error_when_no_supabase(self):
        from engine.proposal import create_proposal

        with pytest.raises(RuntimeError, match="Supabase client not initialized"):
            create_proposal("Fix auth", "Fix the login bug")


# ---------------------------------------------------------------------------
# list_pending — query pending proposals
# ---------------------------------------------------------------------------


class TestListPending:
    """Verify list_pending() queries proposals with status='pending'."""

    @patch("engine.proposal.supabase")
    def test_queries_proposals_table(self, mock_sb):
        from engine.proposal import list_pending

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        list_pending()

        mock_sb.table.assert_called_once_with("proposals")

    @patch("engine.proposal.supabase")
    def test_filters_by_status_pending(self, mock_sb):
        from engine.proposal import list_pending

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        list_pending()

        chain.eq.assert_called_once_with("status", "pending")

    @patch("engine.proposal.supabase")
    def test_orders_by_created_at(self, mock_sb):
        from engine.proposal import list_pending

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        list_pending()

        chain.order.assert_called_once_with("created_at")

    @patch("engine.proposal.supabase")
    def test_returns_list_of_proposals(self, mock_sb):
        from engine.proposal import list_pending

        proposals = [
            {"id": "p1", "title": "A", "status": "pending"},
            {"id": "p2", "title": "B", "status": "pending"},
        ]
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=proposals)
        mock_sb.table.return_value = chain

        result = list_pending()

        assert result == proposals
        assert len(result) == 2

    @patch("engine.proposal.supabase")
    def test_returns_empty_list_when_no_pending(self, mock_sb):
        from engine.proposal import list_pending

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=None)
        mock_sb.table.return_value = chain

        result = list_pending()

        assert result == []

    @patch("engine.proposal.supabase", None)
    def test_raises_runtime_error_when_no_supabase(self):
        from engine.proposal import list_pending

        with pytest.raises(RuntimeError, match="Supabase client not initialized"):
            list_pending()


# ---------------------------------------------------------------------------
# approve — update status + emit event
# ---------------------------------------------------------------------------


class TestApprove:
    """Verify approve() updates proposal and emits event."""

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_updates_status_to_approved(self, mock_sb, mock_emit):
        from engine.proposal import approve

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "approved"}]
        )
        mock_sb.table.return_value = chain

        approve("prop-1")

        update_arg = chain.update.call_args[0][0]
        assert update_arg["status"] == "approved"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_sets_approved_at_timestamp(self, mock_sb, mock_emit):
        from engine.proposal import approve

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "approved"}]
        )
        mock_sb.table.return_value = chain

        approve("prop-1")

        update_arg = chain.update.call_args[0][0]
        assert "approved_at" in update_arg
        # Should be valid ISO datetime
        dt = datetime.fromisoformat(update_arg["approved_at"])
        assert dt.tzinfo is not None

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_sets_approved_by(self, mock_sb, mock_emit):
        from engine.proposal import approve

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "approved"}]
        )
        mock_sb.table.return_value = chain

        approve("prop-1", approved_by="Ed")

        update_arg = chain.update.call_args[0][0]
        assert update_arg["approved_by"] == "Ed"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_default_approved_by_is_sensei(self, mock_sb, mock_emit):
        from engine.proposal import approve

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "approved"}]
        )
        mock_sb.table.return_value = chain

        approve("prop-1")

        update_arg = chain.update.call_args[0][0]
        assert update_arg["approved_by"] == "Sensei"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_filters_by_proposal_id(self, mock_sb, mock_emit):
        from engine.proposal import approve

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "approved"}]
        )
        mock_sb.table.return_value = chain

        approve("prop-1")

        chain.eq.assert_called_once_with("id", "prop-1")

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_returns_updated_proposal(self, mock_sb, mock_emit):
        from engine.proposal import approve

        expected = {"id": "prop-1", "status": "approved", "approved_by": "Sensei"}
        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[expected])
        mock_sb.table.return_value = chain

        result = approve("prop-1")

        assert result == expected

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_emits_proposal_approved_event(self, mock_sb, mock_emit):
        from engine.proposal import approve

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "approved"}]
        )
        mock_sb.table.return_value = chain

        approve("prop-1", approved_by="Sensei")

        mock_emit.assert_called_once()
        event_type = mock_emit.call_args[0][0]
        event_payload = mock_emit.call_args[0][1]
        assert event_type == "proposal_approved"
        assert event_payload["proposal_id"] == "prop-1"
        assert event_payload["approved_by"] == "Sensei"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_returns_fallback_when_no_result_data(self, mock_sb, mock_emit):
        from engine.proposal import approve

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        result = approve("prop-1")

        assert result["id"] == "prop-1"

    @patch("engine.proposal.supabase", None)
    def test_raises_runtime_error_when_no_supabase(self):
        from engine.proposal import approve

        with pytest.raises(RuntimeError, match="Supabase client not initialized"):
            approve("prop-1")


# ---------------------------------------------------------------------------
# reject — update status + emit event
# ---------------------------------------------------------------------------


class TestReject:
    """Verify reject() updates proposal and emits event."""

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_updates_status_to_rejected(self, mock_sb, mock_emit):
        from engine.proposal import reject

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "rejected"}]
        )
        mock_sb.table.return_value = chain

        reject("prop-1")

        update_arg = chain.update.call_args[0][0]
        assert update_arg["status"] == "rejected"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_sets_updated_at_timestamp(self, mock_sb, mock_emit):
        from engine.proposal import reject

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "rejected"}]
        )
        mock_sb.table.return_value = chain

        reject("prop-1")

        update_arg = chain.update.call_args[0][0]
        assert "updated_at" in update_arg
        dt = datetime.fromisoformat(update_arg["updated_at"])
        assert dt.tzinfo is not None

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_filters_by_proposal_id(self, mock_sb, mock_emit):
        from engine.proposal import reject

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "rejected"}]
        )
        mock_sb.table.return_value = chain

        reject("prop-1")

        chain.eq.assert_called_once_with("id", "prop-1")

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_returns_updated_proposal(self, mock_sb, mock_emit):
        from engine.proposal import reject

        expected = {"id": "prop-1", "status": "rejected"}
        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[expected])
        mock_sb.table.return_value = chain

        result = reject("prop-1")

        assert result == expected

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_emits_proposal_rejected_event(self, mock_sb, mock_emit):
        from engine.proposal import reject

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "rejected"}]
        )
        mock_sb.table.return_value = chain

        reject("prop-1", reason="Too risky")

        mock_emit.assert_called_once()
        event_type = mock_emit.call_args[0][0]
        event_payload = mock_emit.call_args[0][1]
        assert event_type == "proposal_rejected"
        assert event_payload["proposal_id"] == "prop-1"
        assert event_payload["reason"] == "Too risky"

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_reason_defaults_to_empty_string(self, mock_sb, mock_emit):
        from engine.proposal import reject

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(
            data=[{"id": "prop-1", "status": "rejected"}]
        )
        mock_sb.table.return_value = chain

        reject("prop-1")

        event_payload = mock_emit.call_args[0][1]
        assert event_payload["reason"] == ""

    @patch("engine.proposal.emit")
    @patch("engine.proposal.supabase")
    def test_returns_fallback_when_no_result_data(self, mock_sb, mock_emit):
        from engine.proposal import reject

        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = chain

        result = reject("prop-1")

        assert result["id"] == "prop-1"

    @patch("engine.proposal.supabase", None)
    def test_raises_runtime_error_when_no_supabase(self):
        from engine.proposal import reject

        with pytest.raises(RuntimeError, match="Supabase client not initialized"):
            reject("prop-1")
