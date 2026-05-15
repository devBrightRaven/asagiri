"""Tests for engine/agents.py — CLI subprocess agent dispatch."""
from __future__ import annotations

import subprocess
from unittest.mock import patch, MagicMock

import pytest

from agents import (
    AgentSpec,
    AgentError,
    REGISTRY,
    detect_available,
    dispatch,
)


# --- detect_available ---

def test_detect_returns_only_agents_on_path():
    def fake_which(binary):
        return f"/usr/bin/{binary}" if binary in {"claude", "codex"} else None
    with patch("agents.shutil.which", side_effect=fake_which):
        agents = detect_available(min_tier=0)
    names = [a.name for a in agents]
    assert "claude" in names
    assert "codex" in names
    assert "gemini" not in names
    assert "ollama" not in names


def test_detect_filters_by_min_tier():
    with patch("agents.shutil.which", return_value="/usr/bin/x"):
        agents = detect_available(min_tier=10)
    assert all(a.tier >= 10 for a in agents)
    assert any(a.name == "claude" for a in agents)
    assert not any(a.name == "gemini" for a in agents)  # gemini tier < 10


def test_detect_sorted_by_tier_desc():
    with patch("agents.shutil.which", return_value="/usr/bin/x"):
        agents = detect_available(min_tier=0)
    tiers = [a.tier for a in agents]
    assert tiers == sorted(tiers, reverse=True)


def test_detect_skips_ollama_when_no_model_configured():
    """ollama needs a model; without OLLAMA_MODEL it cannot be dispatched."""
    with patch("agents.shutil.which", return_value="/usr/bin/x"):
        with patch.dict("os.environ", {}, clear=False):
            import os
            os.environ.pop("OLLAMA_MODEL", None)
            agents = detect_available(min_tier=0)
    assert not any(a.name == "ollama" for a in agents)


def test_detect_includes_ollama_when_model_configured(monkeypatch):
    monkeypatch.setenv("OLLAMA_MODEL", "qwen2.5:7b")
    with patch("agents.shutil.which", return_value="/usr/bin/x"):
        agents = detect_available(min_tier=0)
    ollama = next((a for a in agents if a.name == "ollama"), None)
    assert ollama is not None
    assert "qwen2.5:7b" in " ".join(ollama.cmd_template)


# --- dispatch ---

def _mock_run_success(stdout: str):
    """Build a subprocess.run mock that returns success with given stdout."""
    cp = MagicMock(spec=subprocess.CompletedProcess)
    cp.returncode = 0
    cp.stdout = stdout
    cp.stderr = ""
    return cp


def _mock_run_failure(returncode: int = 1, stderr: str = "boom"):
    cp = MagicMock(spec=subprocess.CompletedProcess)
    cp.returncode = returncode
    cp.stdout = ""
    cp.stderr = stderr
    return cp


def test_dispatch_returns_first_success():
    claude = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    codex = AgentSpec(name="codex", cmd_template=["codex", "exec", "{prompt}"], tier=9)
    with patch("agents.subprocess.run", return_value=_mock_run_success("OK")) as mock_run:
        result = dispatch("hello", [claude, codex])
    assert result.agent == "claude"
    assert result.output == "OK"
    assert mock_run.call_count == 1


def test_dispatch_falls_back_on_nonzero_exit():
    claude = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    codex = AgentSpec(name="codex", cmd_template=["codex", "exec", "{prompt}"], tier=9)
    side_effects = [_mock_run_failure(stderr="rate limit"), _mock_run_success("from codex")]
    with patch("agents.subprocess.run", side_effect=side_effects) as mock_run:
        result = dispatch("hello", [claude, codex])
    assert result.agent == "codex"
    assert result.output == "from codex"
    assert mock_run.call_count == 2


def test_dispatch_falls_back_on_timeout():
    claude = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    codex = AgentSpec(name="codex", cmd_template=["codex", "exec", "{prompt}"], tier=9)
    side_effects = [
        subprocess.TimeoutExpired(cmd="claude", timeout=120),
        _mock_run_success("from codex"),
    ]
    with patch("agents.subprocess.run", side_effect=side_effects) as mock_run:
        result = dispatch("hello", [claude, codex], timeout=120)
    assert result.agent == "codex"
    assert mock_run.call_count == 2


def test_dispatch_raises_when_all_fail():
    claude = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    codex = AgentSpec(name="codex", cmd_template=["codex", "exec", "{prompt}"], tier=9)
    with patch("agents.subprocess.run", return_value=_mock_run_failure(stderr="boom")):
        with pytest.raises(AgentError) as exc_info:
            dispatch("hello", [claude, codex])
    msg = str(exc_info.value)
    assert "claude" in msg
    assert "codex" in msg


def test_dispatch_raises_on_empty_list():
    with pytest.raises(AgentError):
        dispatch("hello", [])


def test_dispatch_substitutes_prompt():
    claude = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agents.subprocess.run", return_value=_mock_run_success("OK")) as mock_run:
        dispatch("the actual prompt", [claude])
    args, kwargs = mock_run.call_args
    cmd = args[0]
    assert cmd == ["claude", "-p", "the actual prompt"]


def test_dispatch_passes_timeout_to_subprocess():
    claude = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agents.subprocess.run", return_value=_mock_run_success("OK")) as mock_run:
        dispatch("p", [claude], timeout=42)
    _, kwargs = mock_run.call_args
    assert kwargs["timeout"] == 42


def test_dispatch_captures_output():
    claude = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agents.subprocess.run", return_value=_mock_run_success("OK")) as mock_run:
        dispatch("p", [claude])
    _, kwargs = mock_run.call_args
    assert kwargs.get("capture_output") is True
    assert kwargs.get("text") is True


# --- REGISTRY shape ---

def test_registry_contains_expected_agents():
    assert set(REGISTRY.keys()) >= {"claude", "codex", "gemini", "ollama"}


def test_registry_tiers_are_ordered_claude_codex_gemini_ollama():
    assert REGISTRY["claude"]["tier"] >= REGISTRY["codex"]["tier"]
    assert REGISTRY["codex"]["tier"] >= REGISTRY["gemini"]["tier"]
    assert REGISTRY["gemini"]["tier"] >= REGISTRY["ollama"]["tier"]


def test_default_min_tier_excludes_gemini_and_ollama():
    """Quality gate at Sonnet 4.6 (tier 8) — only claude + codex by default."""
    with patch("agents.shutil.which", return_value="/usr/bin/x"):
        agents = detect_available()  # default min_tier
    names = {a.name for a in agents}
    assert "claude" in names
    assert "codex" in names
    assert "gemini" not in names
    assert "ollama" not in names
