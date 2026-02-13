"""Tests for engine.mission — Mission runner with affinity-aware assignment."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# create_mission
# ---------------------------------------------------------------------------


class TestCreateMission:
    """Test mission creation with affinity-aware step assignment."""

    @patch("engine.mission.supabase", None)
    def test_raises_without_supabase(self):
        from engine.mission import create_mission

        with pytest.raises(RuntimeError, match="Supabase client not initialized"):
            create_mission(
                proposal_id="p-001",
                title="Test Mission",
                description="Test",
                assigned_to="ed",
                steps=[],
            )

    @patch("engine.mission.emit")
    @patch("engine.mission.supabase")
    def test_creates_mission_record(self, mock_sb, mock_emit):
        from engine.mission import create_mission

        mission_data = {
            "id": "m-001",
            "proposal_id": "p-001",
            "title": "Build API",
            "assigned_to": "ed",
            "status": "queued",
        }

        # Mission insert
        mission_chain = MagicMock()
        mission_chain.insert.return_value = mission_chain
        mission_chain.execute.return_value = MagicMock(data=[mission_data])

        # Steps insert (no steps in this test)
        mock_sb.table.return_value = mission_chain

        result = create_mission(
            proposal_id="p-001",
            title="Build API",
            description="Build REST API",
            assigned_to="ed",
            steps=[],
        )

        assert result["id"] == "m-001"
        assert result["status"] == "queued"
        assert result["assigned_to"] == "ed"

    @patch("engine.mission.emit")
    @patch("engine.mission.get_best_collaborator")
    @patch("engine.mission.DOMAIN_TO_DAIMYO", {"engineering": "ed", "product": "light"})
    @patch("engine.mission.DAIMYO_REGISTRY", {
        "ed": {"name": "Ed", "domain": "engineering"},
        "light": {"name": "Light", "domain": "product"},
    })
    @patch("engine.mission.supabase")
    def test_assigns_step_by_domain(self, mock_sb, mock_collab, mock_emit):
        from engine.mission import create_mission

        mission_data = {
            "id": "m-002",
            "proposal_id": "p-002",
            "title": "Test",
            "assigned_to": "ed",
            "status": "queued",
        }

        step_data = {
            "id": "s-001",
            "mission_id": "m-002",
            "title": "Code step",
            "daimyo": "ed",
            "status": "queued",
        }

        insert_chain = MagicMock()
        insert_chain.insert.return_value = insert_chain

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                # Mission insert
                insert_chain.execute.return_value = MagicMock(data=[mission_data])
            else:
                # Step insert
                insert_chain.execute.return_value = MagicMock(data=[step_data])
            return insert_chain

        mock_sb.table.side_effect = table_router

        result = create_mission(
            proposal_id="p-002",
            title="Test",
            description="Test",
            assigned_to="ed",
            steps=[{"title": "Code step", "kind": "code", "domain": "engineering"}],
        )

        # Should NOT call get_best_collaborator — direct domain match
        mock_collab.assert_not_called()
        assert result["steps"][0]["daimyo"] == "ed"

    @patch("engine.mission.emit")
    @patch("engine.mission.get_best_collaborator")
    @patch("engine.mission.DOMAIN_TO_DAIMYO", {"engineering": "ed"})
    @patch("engine.mission.DAIMYO_REGISTRY", {
        "ed": {"name": "Ed", "domain": "engineering"},
        "light": {"name": "Light", "domain": "product"},
    })
    @patch("engine.mission.supabase")
    def test_uses_affinity_for_unknown_domain(self, mock_sb, mock_collab, mock_emit):
        from engine.mission import create_mission

        mission_data = {
            "id": "m-003",
            "proposal_id": "p-003",
            "title": "Test",
            "assigned_to": "ed",
            "status": "queued",
        }

        step_data = {
            "id": "s-002",
            "mission_id": "m-003",
            "title": "Unknown domain step",
            "daimyo": "light",
            "status": "queued",
        }

        insert_chain = MagicMock()
        insert_chain.insert.return_value = insert_chain

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                insert_chain.execute.return_value = MagicMock(data=[mission_data])
            else:
                insert_chain.execute.return_value = MagicMock(data=[step_data])
            return insert_chain

        mock_sb.table.side_effect = table_router
        mock_collab.return_value = "light"

        result = create_mission(
            proposal_id="p-003",
            title="Test",
            description="Test",
            assigned_to="ed",
            steps=[{"title": "Unknown domain step", "kind": "code", "domain": "mystery"}],
        )

        # Should call get_best_collaborator since domain "mystery" not in DOMAIN_TO_DAIMYO
        mock_collab.assert_called_once()

    @patch("engine.mission.emit")
    @patch("engine.mission.supabase")
    def test_emits_mission_started_event(self, mock_sb, mock_emit):
        from engine.mission import create_mission

        mission_data = {
            "id": "m-004",
            "proposal_id": "p-004",
            "title": "Build Feature",
            "assigned_to": "ed",
            "status": "queued",
        }

        insert_chain = MagicMock()
        insert_chain.insert.return_value = insert_chain
        insert_chain.execute.return_value = MagicMock(data=[mission_data])

        mock_sb.table.return_value = insert_chain

        create_mission(
            proposal_id="p-004",
            title="Build Feature",
            description="Build a feature",
            assigned_to="ed",
            steps=[],
        )

        mock_emit.assert_called_once()
        event_type = mock_emit.call_args[0][0]
        event_payload = mock_emit.call_args[0][1]
        assert event_type == "mission_started"
        assert event_payload["mission_id"] == "m-004"
        assert event_payload["assigned_to"] == "ed"
        assert event_payload["step_count"] == 0

    @patch("engine.mission.emit")
    @patch("engine.mission.supabase")
    def test_includes_project_id_if_provided(self, mock_sb, mock_emit):
        from engine.mission import create_mission

        mission_data = {
            "id": "m-005",
            "proposal_id": "p-005",
            "project_id": "proj-001",
            "title": "Test",
            "assigned_to": "ed",
            "status": "queued",
        }

        insert_chain = MagicMock()
        insert_chain.insert.return_value = insert_chain
        insert_chain.execute.return_value = MagicMock(data=[mission_data])

        mock_sb.table.return_value = insert_chain

        create_mission(
            proposal_id="p-005",
            title="Test",
            description="Test",
            assigned_to="ed",
            steps=[],
            project_id="proj-001",
        )

        # Verify insert was called with project_id
        insert_call = insert_chain.insert.call_args[0][0]
        assert insert_call["project_id"] == "proj-001"


# ---------------------------------------------------------------------------
# run_pending
# ---------------------------------------------------------------------------


class TestRunPending:
    """Test running pending approved proposals."""

    @patch("engine.mission.supabase", None)
    def test_returns_empty_without_supabase(self):
        from engine.mission import run_pending

        result = run_pending()
        assert result == []

    @patch("engine.mission.supabase")
    def test_returns_empty_when_no_approved_proposals(self, mock_sb):
        from engine.mission import run_pending

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = select_chain

        result = run_pending()
        assert result == []

    @patch("engine.mission.create_mission")
    @patch("engine.mission.DOMAIN_TO_DAIMYO", {"engineering": "ed"})
    @patch("engine.mission.supabase")
    def test_creates_mission_for_approved_proposal(self, mock_sb, mock_create):
        from engine.mission import run_pending

        proposal = {
            "id": "p-010",
            "title": "Add auth",
            "description": "Add authentication",
            "domain": "engineering",
            "project_id": "proj-001",
            "status": "approved",
        }

        # First call: proposals query
        proposals_chain = MagicMock()
        proposals_chain.select.return_value = proposals_chain
        proposals_chain.eq.return_value = proposals_chain
        proposals_chain.execute.return_value = MagicMock(data=[proposal])

        # Second call: missions query for existing proposal_ids
        missions_chain = MagicMock()
        missions_chain.select.return_value = missions_chain
        missions_chain.execute.return_value = MagicMock(data=[])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return proposals_chain
            return missions_chain

        mock_sb.table.side_effect = table_router

        mock_create.return_value = {"id": "m-010", "title": "Add auth", "steps": []}

        result = run_pending()

        assert len(result) == 1
        mock_create.assert_called_once()
        # Verify create_mission was called with 3 steps (research, code, review)
        create_call_kwargs = mock_create.call_args
        steps_arg = create_call_kwargs[1].get("steps") or create_call_kwargs[0][4] if len(create_call_kwargs[0]) > 4 else None
        # The steps should be passed via keyword arg
        if steps_arg is None:
            steps_arg = create_call_kwargs.kwargs.get("steps", [])
        assert len(steps_arg) == 3

    @patch("engine.mission.create_mission")
    @patch("engine.mission.DOMAIN_TO_DAIMYO", {"engineering": "ed"})
    @patch("engine.mission.supabase")
    def test_skips_proposals_with_existing_missions(self, mock_sb, mock_create):
        from engine.mission import run_pending

        proposal = {
            "id": "p-020",
            "title": "Already has mission",
            "description": "Already processed",
            "domain": "engineering",
            "status": "approved",
        }

        # Proposals query
        proposals_chain = MagicMock()
        proposals_chain.select.return_value = proposals_chain
        proposals_chain.eq.return_value = proposals_chain
        proposals_chain.execute.return_value = MagicMock(data=[proposal])

        # Missions query — this proposal already has a mission
        missions_chain = MagicMock()
        missions_chain.select.return_value = missions_chain
        missions_chain.execute.return_value = MagicMock(data=[{"proposal_id": "p-020"}])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return proposals_chain
            return missions_chain

        mock_sb.table.side_effect = table_router

        result = run_pending()

        assert result == []
        mock_create.assert_not_called()

    @patch("engine.mission.create_mission")
    @patch("engine.mission.DOMAIN_TO_DAIMYO", {"engineering": "ed"})
    @patch("engine.mission.supabase")
    def test_generates_three_step_heuristic(self, mock_sb, mock_create):
        """K2.5 heuristic should create research -> code -> review steps."""
        from engine.mission import run_pending

        proposal = {
            "id": "p-030",
            "title": "Build feature",
            "description": "Build a new feature",
            "domain": "engineering",
            "status": "approved",
        }

        proposals_chain = MagicMock()
        proposals_chain.select.return_value = proposals_chain
        proposals_chain.eq.return_value = proposals_chain
        proposals_chain.execute.return_value = MagicMock(data=[proposal])

        missions_chain = MagicMock()
        missions_chain.select.return_value = missions_chain
        missions_chain.execute.return_value = MagicMock(data=[])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return proposals_chain
            return missions_chain

        mock_sb.table.side_effect = table_router

        mock_create.return_value = {"id": "m-030", "steps": []}

        run_pending()

        # Verify the steps structure
        create_kwargs = mock_create.call_args.kwargs if mock_create.call_args.kwargs else {}
        steps = create_kwargs.get("steps", [])
        assert len(steps) == 3
        assert steps[0]["kind"] == "research"
        assert steps[1]["kind"] == "code"
        assert steps[2]["kind"] == "review"


# ---------------------------------------------------------------------------
# DOMAIN_TO_DAIMYO mapping
# ---------------------------------------------------------------------------


class TestDomainMapping:
    """Test that DOMAIN_TO_DAIMYO is correctly derived from DAIMYO_REGISTRY."""

    def test_domain_to_daimyo_mapping_exists(self):
        from engine.mission import DOMAIN_TO_DAIMYO

        assert isinstance(DOMAIN_TO_DAIMYO, dict)
        assert len(DOMAIN_TO_DAIMYO) > 0

    def test_engineering_maps_to_ed(self):
        from engine.mission import DOMAIN_TO_DAIMYO

        assert DOMAIN_TO_DAIMYO.get("engineering") == "ed"

    def test_product_maps_to_light(self):
        from engine.mission import DOMAIN_TO_DAIMYO

        assert DOMAIN_TO_DAIMYO.get("product") == "light"

    def test_all_registry_domains_mapped(self):
        from engine.mission import DOMAIN_TO_DAIMYO
        from engine.config import DAIMYO_REGISTRY

        for daimyo_id, info in DAIMYO_REGISTRY.items():
            domain = info.get("domain")
            if domain:
                assert domain in DOMAIN_TO_DAIMYO
                assert DOMAIN_TO_DAIMYO[domain] == daimyo_id
