"""Tests for CLI executor commands."""

from unittest.mock import patch
from click.testing import CliRunner
from cli import cli


class TestExecuteNextCli:
    """Test the execute-next CLI command."""

    @patch("engine.executor.execute_next")
    def test_execute_next_with_step(self, mock_exec):
        mock_exec.return_value = {"id": "step-001", "status": "completed"}

        runner = CliRunner()
        result = runner.invoke(cli, ["execute-next"])

        assert result.exit_code == 0
        assert "step-001" in result.output
        assert "completed" in result.output

    @patch("engine.executor.execute_next")
    def test_execute_next_no_steps(self, mock_exec):
        mock_exec.return_value = None

        runner = CliRunner()
        result = runner.invoke(cli, ["execute-next"])

        assert result.exit_code == 0
        assert "No queued steps" in result.output


class TestExecuteMissionCli:
    """Test the execute-mission CLI command."""

    @patch("engine.executor.execute_mission")
    def test_execute_mission(self, mock_exec):
        mock_exec.return_value = [
            {"id": "s1", "status": "completed"},
            {"id": "s2", "status": "completed"},
        ]

        runner = CliRunner()
        result = runner.invoke(cli, ["execute-mission", "m-001"])

        assert result.exit_code == 0
        assert "Executed 2 steps for mission m-001" in result.output

    @patch("engine.executor.execute_mission")
    def test_execute_mission_no_steps(self, mock_exec):
        mock_exec.return_value = []

        runner = CliRunner()
        result = runner.invoke(cli, ["execute-mission", "m-nonexistent"])

        assert result.exit_code == 0
        assert "Executed 0 steps" in result.output
