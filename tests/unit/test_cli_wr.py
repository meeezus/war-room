"""Tests for CLI `wr` command group."""

from unittest.mock import patch, MagicMock
from click.testing import CliRunner
from cli import cli


def _mock_supabase():
    """Create a mock supabase client with chainable table methods."""
    mock = MagicMock()

    def _table(name):
        tbl = MagicMock()
        tbl._table_name = name
        # Make chainable: .select().execute(), .select().eq().execute(), etc.
        tbl.select.return_value = tbl
        tbl.eq.return_value = tbl
        tbl.order.return_value = tbl
        tbl.insert.return_value = tbl
        tbl.update.return_value = tbl
        tbl.execute.return_value = MagicMock(data=[], count=0)
        mock._tables[name] = tbl
        return tbl

    mock._tables = {}
    mock.table.side_effect = _table
    return mock


class TestWrGroup:
    """Test the wr command group exists and is accessible."""

    def test_wr_help(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "--help"])
        assert result.exit_code == 0
        assert "War Room" in result.output

    def test_wr_subcommands_listed(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "--help"])
        assert result.exit_code == 0
        for cmd in ("status", "tasks", "start", "done", "approve", "propose", "event"):
            assert cmd in result.output


class TestWrStatus:
    """Test wr status command."""

    @patch("engine.config.supabase", None)
    def test_status_no_supabase(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "status"])
        assert result.exit_code == 0
        assert "Supabase not configured" in result.output

    @patch("engine.config.supabase")
    def test_status_shows_dynasty_overview(self, mock_sb):
        mock_sb_client = _mock_supabase()
        # Projects response
        mock_sb_client._tables.clear()

        projects_tbl = MagicMock()
        projects_tbl.select.return_value = projects_tbl
        projects_tbl.execute.return_value = MagicMock(data=[
            {"status": "active"},
            {"status": "active"},
            {"status": "paused"},
        ])

        tasks_tbl = MagicMock()
        tasks_tbl.select.return_value = tasks_tbl
        tasks_tbl.execute.return_value = MagicMock(data=[
            {"status": "in_progress", "updated_at": "2026-02-08T00:00:00Z"},
            {"status": "done", "updated_at": "2026-01-01T00:00:00Z"},
            {"status": "queued", "updated_at": "2025-12-01T00:00:00Z"},
        ])

        proposals_tbl = MagicMock()
        proposals_tbl.select.return_value = proposals_tbl
        proposals_tbl.eq.return_value = proposals_tbl
        proposals_tbl.execute.return_value = MagicMock(data=[], count=2)

        def table_router(name):
            if name == "projects":
                return projects_tbl
            elif name == "tasks":
                return tasks_tbl
            elif name == "proposals":
                return proposals_tbl
            return MagicMock()

        mock_sb_client.table.side_effect = table_router

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "status"])

        assert result.exit_code == 0
        assert "Dynasty Status" in result.output
        assert "Projects:" in result.output
        assert "active: 2" in result.output
        assert "paused: 1" in result.output
        assert "Tasks:" in result.output
        assert "Pending proposals: 2" in result.output
        assert "Stale tasks" in result.output

    @patch("engine.config.supabase")
    def test_status_stale_detection(self, mock_sb):
        """Stale = updated > 7 days ago and not done/someday."""
        mock_sb_client = _mock_supabase()

        projects_tbl = MagicMock()
        projects_tbl.select.return_value = projects_tbl
        projects_tbl.execute.return_value = MagicMock(data=[])

        tasks_tbl = MagicMock()
        tasks_tbl.select.return_value = tasks_tbl
        tasks_tbl.execute.return_value = MagicMock(data=[
            {"status": "in_progress", "updated_at": "2025-01-01T00:00:00Z"},  # stale
            {"status": "queued", "updated_at": "2025-01-01T00:00:00Z"},       # stale
            {"status": "done", "updated_at": "2025-01-01T00:00:00Z"},         # not stale (done)
            {"status": "someday", "updated_at": "2025-01-01T00:00:00Z"},      # not stale (someday)
        ])

        proposals_tbl = MagicMock()
        proposals_tbl.select.return_value = proposals_tbl
        proposals_tbl.eq.return_value = proposals_tbl
        proposals_tbl.execute.return_value = MagicMock(data=[], count=0)

        def table_router(name):
            if name == "projects":
                return projects_tbl
            elif name == "tasks":
                return tasks_tbl
            elif name == "proposals":
                return proposals_tbl
            return MagicMock()

        mock_sb_client.table.side_effect = table_router

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "status"])

        assert result.exit_code == 0
        # 2 stale tasks (in_progress and queued)
        assert "2" in result.output


class TestWrTasks:
    """Test wr tasks command."""

    @patch("engine.config.supabase", None)
    def test_tasks_no_supabase(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "tasks"])
        assert result.exit_code == 0
        assert "Supabase not configured" in result.output

    @patch("engine.config.supabase")
    def test_tasks_empty(self, mock_sb):
        mock_sb_client = _mock_supabase()
        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "tasks"])
        assert result.exit_code == 0
        assert "No tasks found" in result.output

    @patch("engine.config.supabase")
    def test_tasks_lists_all(self, mock_sb):
        mock_sb_client = _mock_supabase()
        tasks_tbl = MagicMock()
        tasks_tbl.select.return_value = tasks_tbl
        tasks_tbl.order.return_value = tasks_tbl
        tasks_tbl.execute.return_value = MagicMock(data=[
            {
                "id": 1,
                "title": "Build dashboard",
                "status": "in_progress",
                "updated_at": "2026-02-08T00:00:00Z",
                "owner": "ed",
                "projects": {"title": "War Room"},
            },
            {
                "id": 2,
                "title": "Fix tests",
                "status": "queued",
                "updated_at": "2025-01-01T00:00:00Z",
                "owner": None,
                "projects": {"title": "Folio"},
            },
        ])
        mock_sb_client.table.side_effect = lambda name: tasks_tbl

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "tasks"])

        assert result.exit_code == 0
        assert "Build dashboard" in result.output
        assert "Fix tests" in result.output
        assert "ed" in result.output
        assert "unassigned" in result.output

    @patch("engine.config.supabase")
    def test_tasks_filter_by_project(self, mock_sb):
        mock_sb_client = _mock_supabase()
        tasks_tbl = MagicMock()
        tasks_tbl.select.return_value = tasks_tbl
        tasks_tbl.order.return_value = tasks_tbl
        tasks_tbl.execute.return_value = MagicMock(data=[
            {
                "id": 1,
                "title": "Build dashboard",
                "status": "in_progress",
                "updated_at": "2026-02-08T00:00:00Z",
                "owner": "ed",
                "projects": {"title": "War Room"},
            },
            {
                "id": 2,
                "title": "Fix tests",
                "status": "queued",
                "updated_at": "2026-02-08T00:00:00Z",
                "owner": None,
                "projects": {"title": "Folio"},
            },
        ])
        mock_sb_client.table.side_effect = lambda name: tasks_tbl

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "tasks", "--project", "war"])

        assert result.exit_code == 0
        assert "Build dashboard" in result.output
        assert "Fix tests" not in result.output

    @patch("engine.config.supabase")
    def test_tasks_stale_flag(self, mock_sb):
        mock_sb_client = _mock_supabase()
        tasks_tbl = MagicMock()
        tasks_tbl.select.return_value = tasks_tbl
        tasks_tbl.order.return_value = tasks_tbl
        tasks_tbl.execute.return_value = MagicMock(data=[
            {
                "id": 1,
                "title": "Fresh task",
                "status": "in_progress",
                "updated_at": "2026-02-08T00:00:00Z",
                "owner": "ed",
                "projects": {"title": "War Room"},
            },
            {
                "id": 2,
                "title": "Old task",
                "status": "queued",
                "updated_at": "2025-01-01T00:00:00Z",
                "owner": None,
                "projects": {"title": "Folio"},
            },
        ])
        mock_sb_client.table.side_effect = lambda name: tasks_tbl

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "tasks", "--stale"])

        assert result.exit_code == 0
        assert "Old task" in result.output
        assert "Fresh task" not in result.output
        assert "[STALE]" in result.output


class TestWrStart:
    """Test wr start command."""

    @patch("engine.config.supabase", None)
    def test_start_no_supabase(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "start", "1"])
        assert result.exit_code == 0
        assert "Supabase not configured" in result.output

    @patch("engine.config.supabase")
    def test_start_task(self, mock_sb):
        mock_sb_client = _mock_supabase()
        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "start", "42"])

        assert result.exit_code == 0
        assert "42" in result.output
        assert "in_progress" in result.output
        # Verify task update was called
        tasks_tbl = mock_sb_client._tables["tasks"]
        tasks_tbl.update.assert_called_once()
        call_args = tasks_tbl.update.call_args[0][0]
        assert call_args["status"] == "in_progress"
        # Verify event was logged
        events_tbl = mock_sb_client._tables["events"]
        events_tbl.insert.assert_called_once()


class TestWrDone:
    """Test wr done command."""

    @patch("engine.config.supabase", None)
    def test_done_no_supabase(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "done", "1"])
        assert result.exit_code == 0
        assert "Supabase not configured" in result.output

    @patch("engine.config.supabase")
    def test_done_task(self, mock_sb):
        mock_sb_client = _mock_supabase()
        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "done", "42"])

        assert result.exit_code == 0
        assert "42" in result.output
        assert "review" in result.output
        tasks_tbl = mock_sb_client._tables["tasks"]
        call_args = tasks_tbl.update.call_args[0][0]
        assert call_args["status"] == "review"


class TestWrApprove:
    """Test wr approve command."""

    @patch("engine.config.supabase", None)
    def test_approve_no_supabase(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "approve", "1"])
        assert result.exit_code == 0
        assert "Supabase not configured" in result.output

    @patch("engine.config.supabase")
    def test_approve_task(self, mock_sb):
        mock_sb_client = _mock_supabase()
        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "approve", "42"])

        assert result.exit_code == 0
        assert "42" in result.output
        assert "done" in result.output
        tasks_tbl = mock_sb_client._tables["tasks"]
        call_args = tasks_tbl.update.call_args[0][0]
        assert call_args["status"] == "done"
        assert "completed_at" in call_args


class TestWrPropose:
    """Test wr propose command."""

    @patch("engine.config.supabase", None)
    def test_propose_no_supabase(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "propose", "New feature"])
        assert result.exit_code == 0
        assert "Supabase not configured" in result.output

    @patch("engine.config.supabase")
    def test_propose_creates_proposal(self, mock_sb):
        mock_sb_client = _mock_supabase()
        proposals_tbl = MagicMock()
        proposals_tbl.insert.return_value = proposals_tbl
        proposals_tbl.execute.return_value = MagicMock(data=[{"id": 1, "title": "New feature"}])
        mock_sb_client.table.side_effect = lambda name: proposals_tbl

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "propose", "New feature"])

        assert result.exit_code == 0
        assert "Proposal created" in result.output
        assert "New feature" in result.output
        call_args = proposals_tbl.insert.call_args[0][0]
        assert call_args["title"] == "New feature"
        assert call_args["source"] == "manual"
        assert call_args["status"] == "pending"

    @patch("engine.config.supabase")
    def test_propose_with_council_flag(self, mock_sb):
        mock_sb_client = _mock_supabase()
        proposals_tbl = MagicMock()
        proposals_tbl.insert.return_value = proposals_tbl
        proposals_tbl.execute.return_value = MagicMock(data=[{"id": 1}])
        mock_sb_client.table.side_effect = lambda name: proposals_tbl

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "propose", "Council idea", "--council"])

        assert result.exit_code == 0
        assert "council review" in result.output
        call_args = proposals_tbl.insert.call_args[0][0]
        assert call_args["council_review"] is True

    @patch("engine.config.supabase")
    def test_propose_failure(self, mock_sb):
        mock_sb_client = _mock_supabase()
        proposals_tbl = MagicMock()
        proposals_tbl.insert.return_value = proposals_tbl
        proposals_tbl.execute.return_value = MagicMock(data=[])
        mock_sb_client.table.side_effect = lambda name: proposals_tbl

        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "propose", "Bad proposal"])

        assert result.exit_code == 0
        assert "Failed to create proposal" in result.output


class TestWrEvent:
    """Test wr event command."""

    @patch("engine.config.supabase", None)
    def test_event_no_supabase(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["wr", "event", "Something happened"])
        assert result.exit_code == 0
        assert "Supabase not configured" in result.output

    @patch("engine.config.supabase")
    def test_event_logs(self, mock_sb):
        mock_sb_client = _mock_supabase()
        with patch("engine.config.supabase", mock_sb_client):
            runner = CliRunner()
            result = runner.invoke(cli, ["wr", "event", "Deploy completed"])

        assert result.exit_code == 0
        assert "Event logged" in result.output
        assert "Deploy completed" in result.output
        events_tbl = mock_sb_client._tables["events"]
        call_args = events_tbl.insert.call_args[0][0]
        assert call_args["type"] == "user_request"
        assert call_args["message"] == "Deploy completed"
