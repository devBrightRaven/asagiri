"""Test: detect_available accepts an explicit ollama_model arg overriding env."""
from __future__ import annotations

from unittest.mock import patch

from agents import detect_available


def test_explicit_ollama_model_arg_takes_precedence(monkeypatch):
    monkeypatch.setenv("OLLAMA_MODEL", "env-model")
    with patch("agents.shutil.which", return_value="/usr/bin/x"):
        agents = detect_available(min_tier=0, ollama_model="arg-model")
    ollama = next((a for a in agents if a.name == "ollama"), None)
    assert ollama is not None
    assert "arg-model" in " ".join(ollama.cmd_template)
    assert "env-model" not in " ".join(ollama.cmd_template)


def test_explicit_none_falls_through_to_env(monkeypatch):
    monkeypatch.setenv("OLLAMA_MODEL", "env-model")
    with patch("agents.shutil.which", return_value="/usr/bin/x"):
        agents = detect_available(min_tier=0, ollama_model=None)
    ollama = next((a for a in agents if a.name == "ollama"), None)
    assert ollama is not None
    assert "env-model" in " ".join(ollama.cmd_template)
