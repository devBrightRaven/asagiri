"""Additional agents.py tests for the bug surfaced in live smoke."""
from __future__ import annotations

import subprocess
from unittest.mock import patch, MagicMock

import pytest

from agents import AgentSpec, AgentError, dispatch


def _mock_run(stdout: str | None, returncode: int = 0, stderr: str = ""):
    cp = MagicMock(spec=subprocess.CompletedProcess)
    cp.returncode = returncode
    cp.stdout = stdout
    cp.stderr = stderr
    return cp


def test_dispatch_treats_empty_stdout_as_failure():
    """An exit-0 with no stdout (reader-thread death on Windows cp932) must
    fall through, not be returned as success."""
    a = AgentSpec(name="a", cmd_template=["a", "{prompt}"], tier=10)
    b = AgentSpec(name="b", cmd_template=["b", "{prompt}"], tier=9)
    with patch(
        "agents.subprocess.run",
        side_effect=[_mock_run(stdout=None, returncode=0), _mock_run(stdout="real", returncode=0)],
    ):
        result = dispatch("p", [a, b])
    assert result.agent == "b"
    assert result.output == "real"


def test_dispatch_treats_blank_stdout_as_failure():
    a = AgentSpec(name="a", cmd_template=["a", "{prompt}"], tier=10)
    b = AgentSpec(name="b", cmd_template=["b", "{prompt}"], tier=9)
    with patch(
        "agents.subprocess.run",
        side_effect=[_mock_run(stdout="", returncode=0), _mock_run(stdout="real", returncode=0)],
    ):
        result = dispatch("p", [a, b])
    assert result.agent == "b"


def test_dispatch_passes_utf8_encoding():
    a = AgentSpec(name="a", cmd_template=["a", "{prompt}"], tier=10)
    with patch("agents.subprocess.run", return_value=_mock_run(stdout="ok")) as mock_run:
        dispatch("p", [a])
    _, kwargs = mock_run.call_args
    assert kwargs.get("encoding") == "utf-8"
    assert kwargs.get("errors") == "replace"
