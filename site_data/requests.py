"""The site's requests: one row per request of every session, subagents included, with the pipeline's definitions.

It keeps the release's request columns but `link_reason`, `stream`,
`tool_definition_names` and `block_ids`, with the role tokens named
`system_tokens` and so on. Each row also carries its `week`, its
session's `harness`, `is_top_level`, `root_session_id` and `depth`, and per
request, each from the pipeline's function: `turn`, `uncached_tokens`,
`hit_ratio`, `wait_s`, `idle_gap_s`, `idle_gap_bin`, `is_trusted_ttft`,
`n_tool_calls`, its rows in the tool calls, and `user_prompt_tokens`, the
tokens of a user step's new prompt (missing for a tool step, and for a user
step whose user tokens did not rise). `missed_tokens_no_ttl` is the tokens the
request missed with no TTL in the cache simulation of its week, joined from the
simulation's per-request misses on week, session and step: missing in a week
without a simulation and for a request the simulation did not replay, as a
subagent's.

The idle gap is the pipeline's, taken over the top-level sessions of each
scope (the pipeline's `population.scope_of` of the harness), every week
together, so a gap never reaches back to a request of the other scope; a
subagent's request has none. The scope itself is not kept: the harness says
it. `idle_gap_bin` is the 0-based bin of `gaps.IDLE_GAP_EDGES_S` the gap falls
in, a gap under the first edge counted in the first bin and one over the last
edge in none.
"""

import pandas

from paper.metrics import gaps, latency, tokens, turns
from release import population, schema
from site_data import loading, session_tree

# The reader's flattened role tokens, and the site's name for each.
ROLE_TOKEN_COLUMNS = {
    "role_tokens.system": "system_tokens",
    "role_tokens.user": "user_tokens",
    "role_tokens.assistant": "assistant_tokens",
    "role_tokens.tool": "tool_tokens",
    "role_tokens.tool_definitions": "tool_definition_tokens",
}
# The frame's columns in order: `week`, the release's columns the site shows, then the added ones.
COLUMNS = [
    "week", "session_id", "step", "start_ms", "end_ms", "ttft_ms", "model", "provider", "step_trigger",
    "waited_for", "prompt_tokens", "completion_tokens", "cache_read_tokens", "system_tokens", "user_tokens",
    "assistant_tokens", "tool_tokens", "tool_definition_tokens", "n_messages", "finish_reason", "transition",
    "cause", "harness", "is_top_level", "root_session_id", "depth", "turn", "uncached_tokens", "hit_ratio", "wait_s",
    "idle_gap_s", "idle_gap_bin", "is_trusted_ttft", "n_tool_calls", "user_prompt_tokens", "missed_tokens_no_ttl",
]
REQUEST_KEY = ["week", "session_id", "step"]  # the columns a request shares with its row of the simulation's misses


def requests_frame(release: loading.WeekTaggedRelease, request_misses: pandas.DataFrame) -> pandas.DataFrame:
    """The site's requests, in week, session and step order; `request_misses` are the simulation's per-request misses
    of the simulated weeks, each row with its `week` (`simulation.request_misses_frame`)."""
    # Oldest week first, as every frame is: the queries add floats in the frames' row order, so this order fixes an
    # answer's last bits.
    requests = release.requests.sort_values(["week", "session_id", "step"], ignore_index=True)
    requests = with_sessions(requests, release.sessions)
    requests["turn"] = turns.turn_numbers(requests)
    requests["wait_s"] = turns.waits(requests)
    requests["uncached_tokens"] = tokens.uncached_tokens(requests).astype("Int64")
    requests["hit_ratio"] = gaps.hit_ratio(requests)
    requests["is_trusted_ttft"] = latency.is_trusted_ttft(requests)
    requests["idle_gap_s"] = top_level_idle_gaps(requests)
    requests["idle_gap_bin"] = idle_gap_bins(requests.idle_gap_s)
    requests["n_tool_calls"] = tool_call_counts(requests, release.tool_calls)
    requests["user_prompt_tokens"] = tokens.user_prompt_tokens(requests).reindex(requests.index).astype("Int64")
    requests["missed_tokens_no_ttl"] = missed_tokens_no_ttl(requests, request_misses)
    requests = loading.with_nullable_integers(requests, schema.REQUESTS_SCHEMA)
    return requests.rename(columns=ROLE_TOKEN_COLUMNS)[COLUMNS]


def with_sessions(requests: pandas.DataFrame, sessions: pandas.DataFrame) -> pandas.DataFrame:
    """The requests with their session's `harness`, `user_id`, `is_top_level`, `root_session_id` and `depth`."""
    orphans = requests.session_id[~requests.session_id.isin(sessions.session_id)].unique()
    if len(orphans) > 0:
        raise ValueError(f"requests of sessions not in the sessions table: {', '.join(orphans)}")
    session_columns = sessions[["session_id", "harness", "user_id", "parent_session_id"]]
    session_columns = session_columns.merge(session_tree.tree_positions(sessions), on="session_id")
    session_columns["is_top_level"] = session_columns.parent_session_id.isna()
    return requests.merge(session_columns, on="session_id", how="left", validate="many_to_one")


def top_level_idle_gaps(requests: pandas.DataFrame) -> pandas.Series:
    """Each top-level request's idle gap in seconds among the top-level requests of its scope, where the pipeline
    gives one; missing on every other row."""
    top_level = requests[requests.is_top_level]
    scopes = top_level.harness.map(population.scope_of)
    idle_gaps = []
    for scope in sorted(scopes.unique()):
        idle_gaps.append(gaps.idle_gap_rows(top_level[scopes == scope]).idle_gap_s)
    return pandas.concat(idle_gaps).reindex(requests.index)


def idle_gap_bins(idle_gap_s: pandas.Series) -> pandas.Series:
    """Each idle gap's 0-based bin in `gaps.IDLE_GAP_EDGES_S`; a short gap counts in the first, a long one in none."""
    first_edge, last_edge = gaps.IDLE_GAP_EDGES_S[0], gaps.IDLE_GAP_EDGES_S[-1]
    clipped = idle_gap_s.clip(lower=first_edge).where(idle_gap_s <= last_edge)
    bins = pandas.cut(clipped, gaps.IDLE_GAP_EDGES_S, labels=False, include_lowest=True)
    return bins.astype("Int64")


def tool_call_counts(requests: pandas.DataFrame, tool_calls: pandas.DataFrame) -> pandas.Series:
    """Each request's rows in the tool calls, joined on session and step; 0 when it has none."""
    calls_per_request = tool_calls.groupby(["session_id", "step"]).size().rename("n_tool_calls").reset_index()
    counted = requests[["session_id", "step"]].merge(calls_per_request, on=["session_id", "step"], how="left")
    return counted.n_tool_calls.fillna(0).astype(int)


def missed_tokens_no_ttl(requests: pandas.DataFrame, request_misses: pandas.DataFrame) -> pandas.Series:
    """Each request's tokens missed with no TTL in its week's simulation, joined on week, session and step; missing
    where the simulation has no row of it."""
    misses = request_misses[[*REQUEST_KEY, "missed_tokens"]]
    refuse_unjoined_misses(misses, requests)
    missed = requests[REQUEST_KEY].merge(misses, on=REQUEST_KEY, how="left", validate="one_to_one")
    return missed.missed_tokens.astype("Int64").set_axis(requests.index)


def refuse_unjoined_misses(misses: pandas.DataFrame, requests: pandas.DataFrame) -> None:
    """Raise when a row of the simulation's misses joins no request: the simulation and the release disagree."""
    joined = misses.merge(requests[REQUEST_KEY], on=REQUEST_KEY, how="left", validate="one_to_one", indicator="joined")
    unjoined = joined[joined.joined == "left_only"]
    if len(unjoined) > 0:
        first = unjoined.iloc[0]
        raise ValueError(f"{len(unjoined)} request misses join no request, the first at step {first.step} of session "
                         f"{first.session_id} in the week of {first.week}")
