"""Tests for engine/agent_research.py — orchestration of search + agent dispatch."""
from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from agent_research import (
    build_search_query,
    format_search_context,
    build_research_prompt,
    parse_idea_response,
    research_one,
)
from agents import AgentSpec, DispatchResult


# --- prompt building ---

def test_build_search_query_uses_domain():
    q = build_search_query("AI/ML", purpose_lens=None)
    assert "AI/ML" in q


def test_build_search_query_includes_lens_when_given():
    q = build_search_query("Health Tech", purpose_lens="accessible independence: ...")
    assert "Health Tech" in q
    assert "accessible" in q.lower()


def test_format_search_context_lists_results():
    results = [
        {"title": "T1", "url": "https://u1", "snippet": "S1", "engine": "google"},
        {"title": "T2", "url": "https://u2", "snippet": "S2", "engine": "duckduckgo"},
    ]
    ctx = format_search_context(results)
    assert "T1" in ctx
    assert "https://u1" in ctx
    assert "S1" in ctx
    assert "T2" in ctx


def test_format_search_context_caps_items():
    results = [{"title": f"T{i}", "url": f"https://u/{i}", "snippet": "S", "engine": "g"} for i in range(20)]
    ctx = format_search_context(results, max_items=3)
    assert "T0" in ctx
    assert "T2" in ctx
    assert "T3" not in ctx


def test_build_research_prompt_combines_everything():
    p = build_research_prompt(
        domain="FinTech",
        search_context="* T1 — https://u1\n  S1",
        purpose_lens=None,
    )
    assert "FinTech" in p
    assert "T1" in p
    assert "JSON" in p  # must instruct JSON output


def test_build_research_prompt_includes_lens():
    p = build_research_prompt(
        domain="FinTech",
        search_context="X",
        purpose_lens="economic self-determination: control over finances",
    )
    assert "economic" in p.lower()


# --- response parsing ---

def test_parse_idea_response_plain_json():
    text = json.dumps({
        "title": "T", "domain": "D", "one_liner": "OL",
        "problem": "P", "solution": "S", "market_size": "M",
        "competitors": ["c1"], "moat_analysis": "MA",
        "feasibility_score": 4, "novelty_score": 5,
        "sources": ["https://x"], "tags": ["t1"],
    })
    data = parse_idea_response(text)
    assert data["title"] == "T"
    assert data["feasibility_score"] == 4


def test_parse_idea_response_handles_markdown_fences():
    payload = {
        "title": "T", "domain": "D", "one_liner": "OL",
        "problem": "P", "solution": "S", "market_size": "M",
        "competitors": [], "moat_analysis": "MA",
        "feasibility_score": 3, "novelty_score": 3,
        "sources": [], "tags": [],
    }
    text = "```json\n" + json.dumps(payload) + "\n```"
    data = parse_idea_response(text)
    assert data["title"] == "T"


def test_parse_idea_response_handles_leading_explanation():
    payload = {
        "title": "T", "domain": "D", "one_liner": "OL",
        "problem": "P", "solution": "S", "market_size": "M",
        "competitors": [], "moat_analysis": "MA",
        "feasibility_score": 3, "novelty_score": 3,
        "sources": [], "tags": [],
    }
    text = "Here is the idea:\n\n" + json.dumps(payload)
    data = parse_idea_response(text)
    assert data["title"] == "T"


# --- research_one ---

def test_research_one_orchestrates_search_and_dispatch():
    fake_search = [
        {"title": "T1", "url": "https://u1", "snippet": "S1", "engine": "g"},
    ]
    fake_idea_payload = {
        "title": "Synthesized idea", "domain": "AI/ML", "one_liner": "OL",
        "problem": "P", "solution": "S", "market_size": "M",
        "competitors": ["c"], "moat_analysis": "MA",
        "feasibility_score": 4, "novelty_score": 5,
        "sources": ["https://x"], "tags": ["t"],
    }
    fake_dispatch = DispatchResult(agent="claude", output=json.dumps(fake_idea_payload))

    agent = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agent_research.search", return_value=fake_search) as mock_search, \
         patch("agent_research.dispatch", return_value=fake_dispatch) as mock_dispatch:
        idea = research_one(
            domain="AI/ML",
            idea_id="2026-05-16-001",
            today_str="2026-05-16",
            agents_chain=[agent],
        )
    assert idea.title == "Synthesized idea"
    assert idea.domain == "AI/ML"
    assert idea.id == "2026-05-16-001"
    mock_search.assert_called_once()
    mock_dispatch.assert_called_once()
    # Search context must have been threaded into the prompt
    _, kwargs = mock_dispatch.call_args
    prompt_arg = mock_dispatch.call_args.args[0]
    assert "T1" in prompt_arg
    assert "AI/ML" in prompt_arg


def test_research_one_passes_lens_to_prompt():
    fake_payload = {
        "title": "T", "domain": "Health Tech", "one_liner": "OL",
        "problem": "P", "solution": "S", "market_size": "M",
        "competitors": [], "moat_analysis": "MA",
        "feasibility_score": 3, "novelty_score": 3,
        "sources": [], "tags": [],
    }
    agent = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agent_research.search", return_value=[]), \
         patch("agent_research.dispatch", return_value=DispatchResult(agent="claude", output=json.dumps(fake_payload))) as mock_dispatch:
        research_one(
            domain="Health Tech",
            idea_id="2026-05-16-002",
            today_str="2026-05-16",
            agents_chain=[agent],
            purpose_lens="accessible independence: enable disabled to live without dependency",
        )
    prompt_arg = mock_dispatch.call_args.args[0]
    assert "accessible" in prompt_arg.lower()


def test_research_one_computes_review_dates():
    fake_payload = {
        "title": "T", "domain": "X", "one_liner": "OL",
        "problem": "P", "solution": "S", "market_size": "M",
        "competitors": [], "moat_analysis": "MA",
        "feasibility_score": 3, "novelty_score": 3,
        "sources": [], "tags": [],
    }
    agent = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agent_research.search", return_value=[]), \
         patch("agent_research.dispatch", return_value=DispatchResult(agent="claude", output=json.dumps(fake_payload))):
        idea = research_one(
            domain="X",
            idea_id="2026-05-16-003",
            today_str="2026-05-16",
            agents_chain=[agent],
        )
    # 4 spaced-repetition checkpoints: +1, +3, +7, +30
    assert len(idea.review_dates) == 4
    assert idea.review_dates[0] == "2026-05-17"
    assert idea.review_dates[-1] == "2026-06-15"


def test_research_one_survives_search_failure():
    """When search.search raises, we still try the agent with empty context."""
    from search import SearchError
    fake_payload = {
        "title": "T", "domain": "X", "one_liner": "OL",
        "problem": "P", "solution": "S", "market_size": "M",
        "competitors": [], "moat_analysis": "MA",
        "feasibility_score": 3, "novelty_score": 3,
        "sources": [], "tags": [],
    }
    agent = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agent_research.search", side_effect=SearchError("all down")), \
         patch("agent_research.dispatch", return_value=DispatchResult(agent="claude", output=json.dumps(fake_payload))) as mock_dispatch:
        idea = research_one(
            domain="X",
            idea_id="2026-05-16-004",
            today_str="2026-05-16",
            agents_chain=[agent],
        )
    assert idea.title == "T"
    # Prompt should still have been built (with empty / no-results context)
    prompt_arg = mock_dispatch.call_args.args[0]
    assert "X" in prompt_arg  # domain still present


def test_research_one_propagates_dispatch_failure():
    from agents import AgentError
    agent = AgentSpec(name="claude", cmd_template=["claude", "-p", "{prompt}"], tier=10)
    with patch("agent_research.search", return_value=[]), \
         patch("agent_research.dispatch", side_effect=AgentError("all agents failed")):
        with pytest.raises(AgentError):
            research_one(
                domain="X",
                idea_id="2026-05-16-005",
                today_str="2026-05-16",
                agents_chain=[agent],
            )
