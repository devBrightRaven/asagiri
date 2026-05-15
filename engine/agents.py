"""Asagiri agent dispatch — CLI subprocess with quality-tiered fallback.

Replaces the SDK-based provider lock-in. Engine sends a prompt to the highest-
tier CLI agent that's available on PATH; on failure (non-zero exit, timeout,
process error) falls through to the next.

Quality tiers
-------------
Hand-curated rough quality estimate, 1..10:

* claude (Claude Code → Sonnet 4.6 / Opus 4.7 by subscription) = 10
* codex  (codex-cli → GPT-5.3 Codex)                            = 9
* gemini (gemini-cli → Flash by default; Pro if configured)     = 7
* ollama (local model — varies by model)                        = 6

Default `min_tier=8` admits only claude + codex (the handoff's gate at Sonnet 4.6).
Lower the gate to include weaker agents.

ollama is registered but is only included when `OLLAMA_MODEL` env var is set,
because the binary alone doesn't tell us which local model to invoke.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Sequence


class AgentError(Exception):
    """Raised when every dispatched agent fails."""


@dataclass(frozen=True)
class AgentSpec:
    name: str
    cmd_template: list[str]
    tier: int


@dataclass(frozen=True)
class DispatchResult:
    agent: str
    output: str


REGISTRY: dict[str, dict] = {
    "claude": {
        "binary": "claude",
        "args": ["-p", "{prompt}"],
        "tier": 10,
        "note": "Claude Code (Sonnet 4.6 / Opus 4.7 via subscription)",
    },
    "codex": {
        "binary": "codex",
        "args": ["exec", "{prompt}"],
        "tier": 9,
        "note": "codex-cli (GPT-5.3 Codex via ChatGPT auth)",
    },
    "gemini": {
        "binary": "gemini",
        "args": ["-p", "{prompt}", "--allowed-mcp-server-names", "none"],
        "tier": 7,
        "note": "gemini-cli (Flash default; Pro if configured)",
    },
    "ollama": {
        "binary": "ollama",
        "args": ["run", "{model}", "{prompt}"],
        "tier": 6,
        "note": "local model — model name from OLLAMA_MODEL env",
    },
}


def detect_available(min_tier: int = 8) -> list[AgentSpec]:
    """Find CLI agents on PATH meeting the quality bar.

    Returns a list of `AgentSpec` sorted by tier descending. ollama is included
    only when `OLLAMA_MODEL` is set in the environment, because the binary
    alone is not dispatchable without a model.
    """
    ollama_model = os.environ.get("OLLAMA_MODEL")
    found: list[AgentSpec] = []
    for name, info in REGISTRY.items():
        if info["tier"] < min_tier:
            continue
        if shutil.which(info["binary"]) is None:
            continue
        if name == "ollama" and not ollama_model:
            continue
        cmd_template = [info["binary"], *info["args"]]
        if name == "ollama":
            cmd_template = [
                arg.replace("{model}", ollama_model)  # type: ignore[arg-type]
                for arg in cmd_template
            ]
        found.append(AgentSpec(name=name, cmd_template=cmd_template, tier=info["tier"]))
    found.sort(key=lambda a: a.tier, reverse=True)
    return found


def dispatch(
    prompt: str,
    agents: Sequence[AgentSpec],
    timeout: int = 120,
) -> DispatchResult:
    """Try each agent in order; return the first non-error result.

    Raises `AgentError` if every agent in the sequence fails. Each agent's
    failure (non-zero exit, timeout, OSError) is collected into the error
    message so the caller can see why each backend lost.
    """
    if not agents:
        raise AgentError("dispatch called with empty agent list")

    errors: list[str] = []
    for agent in agents:
        cmd = [part.replace("{prompt}", prompt) for part in agent.cmd_template]
        try:
            cp = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            errors.append(f"{agent.name}: timeout after {timeout}s")
            continue
        except OSError as e:
            errors.append(f"{agent.name}: OSError {e}")
            continue

        if cp.returncode != 0:
            stderr_tail = (cp.stderr or "").strip().splitlines()[-1:] or [""]
            errors.append(f"{agent.name}: exit {cp.returncode} — {stderr_tail[0]}")
            continue

        return DispatchResult(agent=agent.name, output=cp.stdout)

    raise AgentError(f"All agents failed: {' | '.join(errors)}")
