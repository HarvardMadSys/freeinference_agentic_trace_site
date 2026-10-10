"""The site's sessions: one row per session, subagents included, with totals over its own requests.

Each row keeps the release's `harness`, `parent_session_id`,
`spawned_by_step` and `user_id`, carries its `week`, and takes `scope`,
`root_session_id` and `depth` from its requests in the site's requests.

The totals count the session's own requests only, never its subagents':
`requests`, `user_steps` and `tool_steps` are the pipeline's counts,
`duration_s` its session duration; `tool_calls` sums the requests'
`n_tool_calls`; `first_start_ms` is the earliest `start_ms`; `input_tokens`,
`cached_tokens` and `output_tokens` sum `prompt_tokens`, `cache_read_tokens`
(a missing count as 0) and `completion_tokens`; `reported_input_tokens` sums
`prompt_tokens` over the cache-reporting requests only, the input a cached
share is taken of; `peak_prompt_tokens` is the
largest `prompt_tokens`; `main_model` is the model of most of its requests,
the first in name order on a tie.

A top-level session also holds `subagents`, its subagent sessions at every
depth, and `subagent_requests`, their requests; a subagent holds 0 of both.
"""

import pandas

from paper.metrics import tokens, turns
from release import schema
from site_data import loading

# The release's session columns the site keeps, after `week`.
RELEASE_COLUMNS = ["week", "session_id", "harness", "parent_session_id", "spawned_by_step", "user_id"]
# The frame's columns in order.
COLUMNS = [
    "week", "session_id", "harness", "scope", "parent_session_id", "spawned_by_step", "root_session_id", "depth",
    "user_id", "requests", "user_steps", "tool_steps", "tool_calls", "first_start_ms", "duration_s", "input_tokens",
    "cached_tokens", "reported_input_tokens", "output_tokens", "peak_prompt_tokens", "main_model", "subagents",
    "subagent_requests",
]


def sessions_frame(release: loading.WeekTaggedRelease, requests: pandas.DataFrame) -> pandas.DataFrame:
    """The site's sessions, in the release's order, from the release and the site's requests."""
    totals = request_totals(requests)
    totals["main_model"] = main_models(requests)
    sessions = release.sessions[RELEASE_COLUMNS].merge(
        totals.reset_index(), on="session_id", how="left", validate="one_to_one")
    without_requests = sessions.session_id[sessions.requests.isna()]
    if len(without_requests) > 0:
        raise ValueError(f"sessions without requests: {', '.join(without_requests)}")
    subagents = subagent_totals(totals)
    sessions["subagents"] = sessions.session_id.map(subagents.subagents).fillna(0).astype(int)
    sessions["subagent_requests"] = sessions.session_id.map(subagents.subagent_requests).fillna(0).astype(int)
    return loading.with_nullable_integers(sessions, schema.SESSIONS_SCHEMA)[COLUMNS]


def request_totals(requests: pandas.DataFrame) -> pandas.DataFrame:
    """Per session, indexed by session id: its place as its requests carry it, and the totals of its own requests."""
    by_session = requests.groupby("session_id")
    totals = by_session.agg(
        scope=("scope", "first"),
        root_session_id=("root_session_id", "first"),
        depth=("depth", "first"),
        tool_calls=("n_tool_calls", "sum"),
        first_start_ms=("start_ms", "min"),
        input_tokens=("prompt_tokens", "sum"),
        output_tokens=("completion_tokens", "sum"),
        peak_prompt_tokens=("prompt_tokens", "max"),
    )
    totals["cached_tokens"] = requests.cache_read_tokens.fillna(0).groupby(requests.session_id).sum()
    reported_input = requests.prompt_tokens.where(tokens.is_cache_reporting(requests), 0)
    totals["reported_input_tokens"] = reported_input.groupby(requests.session_id).sum()
    totals["duration_s"] = turns.session_durations(requests)
    return totals.join(turns.counts_per_session(requests))


def main_models(requests: pandas.DataFrame) -> pandas.Series:
    """Per session, indexed by session id: the model of most of its requests, the first in name order on a tie."""
    model_counts = requests.groupby(["session_id", "model"]).size().rename("model_requests").reset_index()
    ranked = model_counts.sort_values(["session_id", "model_requests", "model"], ascending=[True, False, True])
    return ranked.drop_duplicates("session_id").set_index("session_id").model


def subagent_totals(totals: pandas.DataFrame) -> pandas.DataFrame:
    """Per top-level session with subagents, indexed by its id: `subagents` at every depth and `subagent_requests`."""
    subagent_rows = totals[totals.depth > 0]
    return subagent_rows.groupby("root_session_id").agg(
        subagents=("requests", "size"),
        subagent_requests=("requests", "sum"),
    )
