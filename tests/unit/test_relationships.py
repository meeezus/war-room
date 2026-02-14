"""Tests for engine.relationships — Affinity and drift system."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# get_affinity
# ---------------------------------------------------------------------------


class TestGetAffinity:
    """Test affinity score retrieval between agents."""

    def test_same_agent_returns_one(self):
        from engine.relationships import get_affinity

        assert get_affinity("ed", "ed") == 1.0

    @patch("engine.relationships.supabase", None)
    def test_no_supabase_returns_default(self):
        from engine.relationships import get_affinity

        assert get_affinity("ed", "light") == 0.5

    @patch("engine.relationships.supabase")
    def test_finds_affinity_forward_direction(self, mock_sb):
        from engine.relationships import get_affinity

        chain = MagicMock()
        chain.table.return_value = chain
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[{"affinity": 0.85}])

        mock_sb.table = chain.table
        mock_sb.table.return_value = chain

        result = get_affinity("ed", "light")
        assert result == 0.85

    @patch("engine.relationships.supabase")
    def test_finds_affinity_reverse_direction(self, mock_sb):
        from engine.relationships import get_affinity

        call_count = [0]
        chain = MagicMock()

        def make_chain():
            c = MagicMock()
            c.select.return_value = c
            c.eq.return_value = c
            c.limit.return_value = c
            return c

        chain1 = make_chain()
        chain1.execute.return_value = MagicMock(data=[])  # Forward: not found

        chain2 = make_chain()
        chain2.execute.return_value = MagicMock(data=[{"affinity": 0.72}])  # Reverse: found

        chains = [chain1, chain2]
        call_count = [0]

        def table_side_effect(name):
            c = chains[call_count[0]] if call_count[0] < len(chains) else chains[-1]
            call_count[0] += 1
            return c

        mock_sb.table.side_effect = table_side_effect

        result = get_affinity("ed", "light")
        assert result == 0.72

    @patch("engine.relationships.supabase")
    def test_no_relationship_returns_default(self, mock_sb):
        from engine.relationships import get_affinity

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = chain

        result = get_affinity("ed", "power")
        assert result == 0.5

    @patch("engine.relationships.supabase")
    def test_exception_returns_default(self, mock_sb):
        from engine.relationships import get_affinity

        mock_sb.table.side_effect = Exception("DB connection failed")

        result = get_affinity("ed", "light")
        assert result == 0.5


# ---------------------------------------------------------------------------
# get_best_collaborator
# ---------------------------------------------------------------------------


class TestGetBestCollaborator:
    """Test picking the best collaborator by affinity."""

    def test_empty_candidates_returns_primary(self):
        from engine.relationships import get_best_collaborator

        result = get_best_collaborator("ed", [])
        assert result == "ed"

    @patch("engine.relationships.get_affinity")
    def test_picks_highest_affinity_candidate(self, mock_affinity):
        from engine.relationships import get_best_collaborator

        def affinity_lookup(a, b):
            scores = {
                ("ed", "light"): 0.9,
                ("ed", "toji"): 0.3,
                ("ed", "power"): 0.6,
            }
            return scores.get((a, b), 0.5)

        mock_affinity.side_effect = affinity_lookup

        result = get_best_collaborator("ed", ["light", "toji", "power"])
        assert result == "light"

    @patch("engine.relationships.get_affinity")
    def test_single_candidate_returns_that_candidate(self, mock_affinity):
        from engine.relationships import get_best_collaborator

        mock_affinity.return_value = 0.5

        result = get_best_collaborator("ed", ["toji"])
        assert result == "toji"

    @patch("engine.relationships.get_affinity")
    def test_tie_returns_first_candidate(self, mock_affinity):
        from engine.relationships import get_best_collaborator

        mock_affinity.return_value = 0.7  # All same score

        result = get_best_collaborator("ed", ["light", "toji", "power"])
        # First one encountered with highest score wins
        assert result == "light"


# ---------------------------------------------------------------------------
# apply_drift
# ---------------------------------------------------------------------------


class TestApplyDrift:
    """Test affinity drift after mission completion."""

    @patch("engine.relationships.supabase", None)
    def test_no_supabase_returns_empty(self):
        from engine.relationships import apply_drift

        result = apply_drift([("ed", "light")], success=True)
        assert result == []

    def test_same_agent_pairs_skipped(self):
        """Pairs where agent_a == agent_b should be skipped."""
        from engine.relationships import apply_drift

        with patch("engine.relationships.supabase") as mock_sb:
            result = apply_drift([("ed", "ed")], success=True)
            # Should not query supabase for same-agent pairs
            mock_sb.table.assert_not_called()

    @patch("engine.relationships.supabase")
    def test_success_increases_affinity_by_003(self, mock_sb):
        from engine.relationships import apply_drift

        # Setup: existing relationship at 0.50
        rel_data = {
            "id": "rel-001",
            "agent_a": "ed",
            "agent_b": "light",
            "affinity": 0.50,
            "drift_history": [],
        }

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[rel_data])

        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        updated_data = {**rel_data, "affinity": 0.53}
        update_chain.execute.return_value = MagicMock(data=[updated_data])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router

        result = apply_drift([("ed", "light")], success=True)

        assert len(result) == 1
        # Verify update was called with new_affinity = 0.53
        update_args = update_chain.update.call_args[0][0]
        assert abs(update_args["affinity"] - 0.53) < 0.001
        # Verify drift_history entry
        assert len(update_args["drift_history"]) == 1
        entry = update_args["drift_history"][0]
        assert entry["delta"] == 0.03
        assert entry["old"] == 0.50
        assert abs(entry["new"] - 0.53) < 0.001
        assert entry["reason"] == "mission_success"

    @patch("engine.relationships.supabase")
    def test_failure_decreases_affinity_by_002(self, mock_sb):
        from engine.relationships import apply_drift

        rel_data = {
            "id": "rel-002",
            "agent_a": "ed",
            "agent_b": "toji",
            "affinity": 0.60,
            "drift_history": [],
        }

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[rel_data])

        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        updated_data = {**rel_data, "affinity": 0.58}
        update_chain.execute.return_value = MagicMock(data=[updated_data])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router

        result = apply_drift([("ed", "toji")], success=False)

        assert len(result) == 1
        update_args = update_chain.update.call_args[0][0]
        assert abs(update_args["affinity"] - 0.58) < 0.001
        entry = update_args["drift_history"][0]
        assert entry["delta"] == -0.02
        assert entry["reason"] == "mission_failure"

    @patch("engine.relationships.supabase")
    def test_affinity_capped_at_095(self, mock_sb):
        from engine.relationships import apply_drift

        rel_data = {
            "id": "rel-003",
            "agent_a": "ed",
            "agent_b": "light",
            "affinity": 0.94,
            "drift_history": [],
        }

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[rel_data])

        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[{**rel_data, "affinity": 0.95}])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router

        apply_drift([("ed", "light")], success=True)

        update_args = update_chain.update.call_args[0][0]
        assert update_args["affinity"] == 0.95  # Capped, not 0.97

    @patch("engine.relationships.supabase")
    def test_affinity_floored_at_010(self, mock_sb):
        from engine.relationships import apply_drift

        rel_data = {
            "id": "rel-004",
            "agent_a": "ed",
            "agent_b": "toji",
            "affinity": 0.11,
            "drift_history": [],
        }

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[rel_data])

        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[{**rel_data, "affinity": 0.10}])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router

        apply_drift([("ed", "toji")], success=False)

        update_args = update_chain.update.call_args[0][0]
        # 0.11 - 0.02 = 0.09, floored to 0.10
        assert update_args["affinity"] == 0.10

    @patch("engine.relationships.supabase")
    def test_no_relationship_found_skips(self, mock_sb):
        from engine.relationships import apply_drift

        # Both forward and reverse return empty
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = chain

        result = apply_drift([("ed", "unknown_agent")], success=True)
        assert result == []

    @patch("engine.relationships.supabase")
    def test_exception_continues_to_next_pair(self, mock_sb):
        from engine.relationships import apply_drift

        mock_sb.table.side_effect = Exception("DB error")

        # Should not raise, should return empty
        result = apply_drift([("ed", "light"), ("ed", "toji")], success=True)
        assert result == []

    @patch("engine.relationships.supabase")
    def test_normalizes_pair_order(self, mock_sb):
        """Pairs should be sorted alphabetically for consistency."""
        from engine.relationships import apply_drift

        rel_data = {
            "id": "rel-005",
            "agent_a": "ed",
            "agent_b": "light",
            "affinity": 0.50,
            "drift_history": [],
        }

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[rel_data])

        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[{**rel_data, "affinity": 0.53}])

        call_count = [0]

        def table_router(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_router

        # Pass in reverse order — should still query ("ed", "light") first
        apply_drift([("light", "ed")], success=True)

        # The first .eq call on select_chain should be for agent_a = "ed" (sorted first)
        eq_calls = select_chain.eq.call_args_list
        # First eq call should have "ed" somewhere (the sorted-first agent)
        all_eq_args = [c[0] for c in eq_calls]
        agent_a_call = all_eq_args[0]  # ("agent_a", "ed")
        assert agent_a_call == ("agent_a", "ed")
