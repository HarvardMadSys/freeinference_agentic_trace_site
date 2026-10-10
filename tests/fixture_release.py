"""A two-week release in the pipeline's layout, small enough to check by hand, and a simulation of its first week.

Eight sessions, twenty requests and sixteen tool calls:
- `tree-root` spawns `tree-child` and `tree-sibling` from step 1; `tree-child`
  spawns `tree-grandchild`, at depth 2; the two children's requests overlap;
- `swe-bench` runs the benchmark scaffold, at a provider that reports no cache reads;
- `mutation` rewrites its context at step 1;
- `idle-week-1` and `idle-week-2` belong to one user at one provider, so the
  second's first request has an idle gap that crosses the week boundary.

A request is tool-triggered exactly when the request before it called tools,
so a call's latency is always time spent on tools, never a person's idle time;
a session may end on a call. Times are given in seconds after the Sunday
00:00 UTC of the session's week.
"""

import dataclasses
import datetime
import json
import pathlib

import pandas
import pyarrow

from release import convert, reader, schema
from simulation import weekly_files

FIRST_WEEK = "2026-05-31_2026-06-06"  # spans May and June
SECOND_WEEK = "2026-06-07_2026-06-13"
SIMULATED_WEEK = FIRST_WEEK  # the second week has no simulation folder
TOOL_RESULT_TOKENS = 100  # every call's result is this long


@dataclasses.dataclass(frozen=True)
class FixtureSession:
    """One row of `sessions.parquet`, and the week folder it is written to."""

    session_id: str
    week: str
    user_id: str
    harness: str
    parent_session_id: str | None = None
    spawned_by_step: int | None = None
    spawned_by_call_index: int | None = None


@dataclasses.dataclass(frozen=True)
class FixtureRequest:
    """One row of `requests.parquet`, its times in seconds after its week's Sunday, and the tools it called."""

    session_id: str
    step: int
    start_s: int
    end_s: int
    step_trigger: str
    waited_for: str | None  # none at step 0
    prompt_tokens: int
    cache_read_tokens: int | None  # none where the provider reports no cache reads
    calls: tuple[str, ...] = ()  # the tools its response called, in order
    ttft_ms: int | None = 1_000
    provider: str = "A"
    transition: str = "append"  # against step - 1; the release has none at step 0
    cause: str | None = None


@dataclasses.dataclass(frozen=True)
class FixtureTool:
    """What a tool's calls record besides their name."""

    category: str
    programs: list[str] | None = None  # shell calls only
    parse_status: str | None = None  # shell calls only


TOOLS = {
    "read": FixtureTool(category="Read"),
    "edit": FixtureTool(category="Edit"),
    "task": FixtureTool(category="Subagent"),
    "bash": FixtureTool(category="*Build/Test", programs=["pytest"], parse_status="success"),
}

SESSIONS = (
    FixtureSession("tree-root", FIRST_WEEK, "user-a", "claude-code"),
    FixtureSession("tree-child", FIRST_WEEK, "user-a", "claude-code", "tree-root", 1, 0),
    FixtureSession("tree-sibling", FIRST_WEEK, "user-a", "claude-code", "tree-root", 1, 1),
    FixtureSession("tree-grandchild", FIRST_WEEK, "user-a", "claude-code", "tree-child", 0, 0),
    FixtureSession("swe-bench", FIRST_WEEK, "user-c", "eval:swe-bench"),
    FixtureSession("idle-week-1", FIRST_WEEK, "user-e", "pi"),
    FixtureSession("mutation", SECOND_WEEK, "user-d", "codex"),
    FixtureSession("idle-week-2", SECOND_WEEK, "user-e", "pi"),
)

REQUESTS = (
    # session_id, step, start_s, end_s, step_trigger, waited_for, prompt_tokens, cache_read_tokens, calls
    FixtureRequest("tree-root", 0, 1_000, 1_010, "user", None, 1_000, 0, ("read",), ttft_ms=2_000),
    FixtureRequest("tree-root", 1, 1_020, 1_030, "tool", "tool", 2_000, 1_000, ("task", "task")),
    FixtureRequest("tree-root", 2, 1_100, 1_110, "tool", "subagent", 3_000, 2_000, ("edit",), ttft_ms=9_900),
    FixtureRequest("tree-root", 3, 1_120, 1_130, "tool", "tool", 4_000, 3_000, ("bash",), ttft_ms=None),
    FixtureRequest("tree-root", 4, 1_300, 1_310, "tool", "tool", 5_000, 4_000),
    FixtureRequest("tree-child", 0, 1_031, 1_040, "user", None, 500, 0, ("task",)),
    FixtureRequest("tree-child", 1, 1_060, 1_070, "tool", "subagent", 800, 500, ("read",)),
    FixtureRequest("tree-sibling", 0, 1_032, 1_045, "user", None, 500, 0, ("read",)),
    FixtureRequest("tree-sibling", 1, 1_050, 1_058, "tool", "tool", 700, 500, ("bash",)),
    FixtureRequest("tree-grandchild", 0, 1_041, 1_050, "user", None, 400, 0),
    FixtureRequest("swe-bench", 0, 2_000, 2_010, "user", None, 800, None, ("bash",), provider="C"),
    FixtureRequest("swe-bench", 1, 2_015, 2_025, "tool", "tool", 1_000, None, ("bash",), provider="C"),
    FixtureRequest("idle-week-1", 0, 604_000, 604_010, "user", None, 1_000, 0, ("read",), provider="B"),
    FixtureRequest("idle-week-1", 1, 604_030, 604_040, "tool", "tool", 1_200, 900, ("read",), provider="B"),
    FixtureRequest("idle-week-1", 2, 604_045, 604_200, "tool", "tool", 1_400, 1_200, ("bash",), provider="B"),
    FixtureRequest("mutation", 0, 1_000, 1_010, "user", None, 2_000, 0, ("bash",)),
    FixtureRequest("mutation", 1, 1_020, 1_030, "tool", "tool", 1_500, 0, ("read",),
                   transition="mutation", cause="compaction"),
    FixtureRequest("mutation", 2, 1_200, 1_210, "tool", "tool", 1_800, 1_500),
    FixtureRequest("idle-week-2", 0, 4_200, 4_210, "user", None, 1_000, 800, provider="B"),
    FixtureRequest("idle-week-2", 1, 4_300, 4_310, "user", "user", 1_200, 1_000, provider="B"),
)


def write_fixture_release(release_directory: pathlib.Path, simulation_directory: pathlib.Path) -> None:
    """Write both weeks into the release folder, and the first week's simulation into the simulation folder."""
    for week in (FIRST_WEEK, SECOND_WEEK):
        write_week(release_directory / week)
    write_simulation(simulation_directory / SIMULATED_WEEK, release_directory / SIMULATED_WEEK)


def write_week(week_directory: pathlib.Path) -> None:
    """One week's manifest, its three tables and `tables.json`, as `release convert` writes them."""
    week_directory.mkdir(parents=True)
    manifest = {"format_version": schema.FORMAT_VERSION, "week": week_directory.name, "files": {}}
    (week_directory / schema.MANIFEST_FILE).write_text(json.dumps(manifest, indent=2) + "\n")
    sessions = [session for session in SESSIONS if session.week == week_directory.name]
    session_weeks = {session.session_id: week_directory.name for session in sessions}
    requests = [request for request in REQUESTS if request.session_id in session_weeks]
    tables = {
        schema.SESSIONS_FILE: sessions_table(sessions),
        schema.REQUESTS_FILE: requests_table(requests, week_start_ms(week_directory)),
        schema.TOOL_CALLS_FILE: tool_calls_table(requests),
    }
    files = {}
    for file_name, table in tables.items():
        files[file_name] = convert.write_table(week_directory, file_name, table)
    record = {"manifest_sha256": reader.file_sha256(week_directory / schema.MANIFEST_FILE), "files": files}
    (week_directory / schema.TABLES_FILE).write_text(json.dumps(record, indent=2) + "\n")


def week_start_ms(week_directory: pathlib.Path) -> int:
    """The Sunday 00:00 UTC a week folder is named by, in milliseconds since the epoch."""
    sunday = datetime.datetime.fromisoformat(reader.week_sunday(week_directory)).replace(tzinfo=datetime.UTC)
    return int(sunday.timestamp()) * schema.MILLISECONDS_PER_SECOND


def sessions_table(sessions: list[FixtureSession]) -> pyarrow.Table:
    """The sessions in `sessions.parquet`'s columns, by session id."""
    rows = []
    for session in sorted(sessions, key=by_session_id):
        row = dataclasses.asdict(session)
        del row["week"]
        rows.append(row)
    return pyarrow.Table.from_pylist(rows, schema=schema.SESSIONS_SCHEMA)


def by_session_id(session: FixtureSession) -> str:
    """The sort key of a session."""
    return session.session_id


def requests_table(requests: list[FixtureRequest], week_start: int) -> pyarrow.Table:
    """The requests in `requests.parquet`'s columns, in session and step order."""
    rows = [request_row(request, week_start) for request in sorted(requests, key=request_key)]
    return pyarrow.Table.from_pylist(rows, schema=schema.REQUESTS_SCHEMA)


def request_key(request: FixtureRequest) -> schema.RequestKey:
    """The request's session and step, its sort key."""
    return schema.RequestKey(request.session_id, request.step)


def request_row(request: FixtureRequest, week_start: int) -> dict:
    """One row of `requests.parquet`; step 0 has no link reason, wait or transition, as in the release."""
    first_step = request.step == 0
    link_reason = "tool_call_id" if request.step_trigger == "tool" else "assistant_message"
    return {
        "session_id": request.session_id,
        "step": request.step,
        "link_reason": None if first_step else link_reason,
        "start_ms": week_start + request.start_s * schema.MILLISECONDS_PER_SECOND,
        "end_ms": week_start + request.end_s * schema.MILLISECONDS_PER_SECOND,
        "ttft_ms": request.ttft_ms,
        "model": "model-x",
        "provider": request.provider,
        "stream": True,
        "step_trigger": request.step_trigger,
        "waited_for": request.waited_for,
        "prompt_tokens": request.prompt_tokens,
        "completion_tokens": 100,
        "cache_read_tokens": request.cache_read_tokens,
        "role_tokens": {"system": 100, "user": 200, "assistant": 50 * request.step, "tool": 50 * request.step,
                        "tool_definitions": 300},
        "n_messages": 2 * request.step + 2,
        "tool_definition_names": sorted(TOOLS),
        "finish_reason": "tool_calls" if request.calls else "stop",
        "transition": None if first_step else request.transition,
        "cause": request.cause,
        "block_ids": [],
    }


def tool_calls_table(requests: list[FixtureRequest]) -> pyarrow.Table:
    """Every call of the requests' responses; a call's latency is the wait until its session's next request."""
    start_s = {request_key(request): request.start_s for request in requests}
    rows = []
    for request in sorted(requests, key=request_key):
        following = start_s.get(schema.RequestKey(request.session_id, request.step + 1))
        latency_ms = None if following is None else (following - request.end_s) * schema.MILLISECONDS_PER_SECOND
        for call_index, name in enumerate(request.calls):
            rows.append(tool_call_row(request, call_index, name, latency_ms))
    return pyarrow.Table.from_pylist(rows, schema=schema.TOOL_CALLS_SCHEMA)


def tool_call_row(request: FixtureRequest, call_index: int, name: str, latency_ms: int | None) -> dict:
    """One row of `tool_calls.parquet`."""
    tool = TOOLS[name]
    return {
        "session_id": request.session_id,
        "step": request.step,
        "call_index": call_index,
        "name": name,
        "category": tool.category,
        "programs": tool.programs,
        "parse_status": tool.parse_status,
        "arguments_skeleton": '{"path": "str"}',
        "outcome": "ok",
        "result_tokens": TOOL_RESULT_TOKENS,
        "latency_ms": latency_ms,
    }


def write_simulation(simulated_week: pathlib.Path, week_directory: pathlib.Path) -> None:
    """A few tallies and the totals of one week, with `sources.json` naming the week's manifest."""
    simulated_week.mkdir(parents=True)
    tallies = pandas.DataFrame({
        "scope": ["Agentic", "Agentic", "Agentic", "SWE-Bench"],
        "policy": ["ttl_only", "ttl_only", "reclaim_both", "ttl_only"],
        "ttl": ["5m", "1h", "5m", "5m"],
        "hit_tokens": [6_000, 8_000, 6_000, 1_000],
        "miss_tokens": [4_000, 2_000, 4_000, 1_000],
        "reusable_token_seconds": [1_000.0, 3_000.0, 900.0, 100.0],
        "dead_token_seconds": [500.0, 2_000.0, 0.0, 50.0],
    })
    totals = pandas.DataFrame({
        "scope": ["Agentic", "SWE-Bench"],
        "active_token_seconds": [20_000.0, 2_000.0],
        "span_seconds": [603_200.0, 25.0],
        "output_tokens": [1_300.0, 200.0],
        "requests": [13, 2],
    })
    tallies.to_parquet(simulated_week / weekly_files.TALLIES_FILE, index=False)
    totals.to_parquet(simulated_week / weekly_files.TOTALS_FILE, index=False)
    weekly_files.record_sources(simulated_week, week_directory, [weekly_files.TALLIES_FILE, weekly_files.TOTALS_FILE])
