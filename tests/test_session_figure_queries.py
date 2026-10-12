"""The Sessions figures that rank sessions or split latency, on the fixture data: each figure's rows by hand; and the
speed-up's rules the fixture does not hold (a capped tool wait, a session or a harness with no trusted TTFT), against
the pipeline's own speed-ups over a few rows.

Every request of `fixture_release.REQUESTS` writes 100 output tokens. The paper's harnesses have four top-level
sessions over both weeks, `tree-root`, `idle-week-1`, `mutation` and `idle-week-2`; fewer than ten sessions make one
rank bin, at the 50th percentile. Every row of a rank-bin query holds the same `ranked_bin` and, in `rows`, the number
of sessions ranked; `bin_sessions` is its own bin's.
"""

import duckdb
import pandas
import pyarrow
import pytest

from paper.metrics import binning, latency, turns

import fixture_release
import site_database

CACHED_PRICE, UNCACHED_PRICE, OUTPUT_PRICE = 1, 10, 50  # per cached input, uncached input and output token
ONE_BIN_PERCENTILE = 50.0  # the middle of the only rank bin
RANKED_BIN = "ranked sessions"  # the one bin the page counts a rank-bin figure's rows in

# The cost of each top-level session of the paper's harnesses, (cached, uncached, output), from its requests' input
# and cached tokens: every request reports cache reads.
AGENTIC_SESSION_COSTS = {
    "tree-root": (10_000 * CACHED_PRICE, 5_000 * UNCACHED_PRICE, 500 * OUTPUT_PRICE),
    "idle-week-1": (2_100 * CACHED_PRICE, 1_500 * UNCACHED_PRICE, 300 * OUTPUT_PRICE),
    "mutation": (1_500 * CACHED_PRICE, 3_800 * UNCACHED_PRICE, 300 * OUTPUT_PRICE),
    "idle-week-2": (1_800 * CACHED_PRICE, 400 * UNCACHED_PRICE, 200 * OUTPUT_PRICE),
}
COST_PARTS = ["cached", "uncached", "output"]


def mean_shares(costs: dict[str, tuple[float, ...]]) -> list[float]:
    """The mean over sessions of each part's share of the session's whole."""
    sums = [0.0] * len(next(iter(costs.values())))
    for parts in costs.values():
        for index, part in enumerate(parts):
            sums[index] += part / sum(parts)
    return [total / len(costs) for total in sums]


def pooled_shares(costs: dict[str, tuple[float, ...]]) -> list[float]:
    """Each part's share of the sessions' parts summed."""
    totals = [sum(column) for column in zip(*costs.values())]
    return [total / sum(totals) for total in totals]


def test_the_cost_share_of_four_sessions_is_one_bin_of_their_mean_shares(connection: duckdb.DuckDBPyConnection,
                                                                         fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/cost_share_by_session")
    assert len(rows) == 1
    row = rows.iloc[0]
    assert (row.percentile, row.ranked_bin) == (ONE_BIN_PERCENTILE, RANKED_BIN)
    assert (row.bin_sessions, row.rows) == (len(AGENTIC_SESSION_COSTS), len(AGENTIC_SESSION_COSTS))
    assert [row[part] for part in COST_PARTS] == pytest.approx(mean_shares(AGENTIC_SESSION_COSTS))
    pooled = [row[f"pooled_{part}"] for part in COST_PARTS]
    assert pooled == pytest.approx(pooled_shares(AGENTIC_SESSION_COSTS))


def test_the_cost_share_leaves_out_a_session_whose_provider_reports_no_cache_reads(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    # Of the benchmark's sessions, `swe-bench` runs at a provider that reports no cache reads; `idle-benchmark` reads
    # none of its 600 input tokens from cache and writes 100 output tokens.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.BENCHMARK_HARNESSES)
    rows = site_database.run_query(connection, "figures/cost_share_by_session")
    expected = {"idle-benchmark": (0, 600 * UNCACHED_PRICE, 100 * OUTPUT_PRICE)}
    assert (rows.bin_sessions.tolist(), rows.rows.tolist()) == ([1], [1])
    assert [rows.iloc[0][part] for part in COST_PARTS] == pytest.approx(mean_shares(expected))


def test_the_cost_share_of_no_weeks_has_no_rows(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [], fixture_release.EVERY_HARNESS)
    assert site_database.run_query(connection, "figures/cost_share_by_session").empty


# The decode times, in seconds, of the paper's harnesses' eleven top-level requests with a trusted TTFT, all on
# `model-x`: every request lasts 10 s with a 1 s TTFT but `tree-root`'s step 0 (TTFT 2 s) and `idle-week-1`'s step 2
# (155 s); `tree-root`'s step 2 (TTFT 99% of its latency) and step 3 (no TTFT) are not trusted.
DECODE_TIMES_S = [8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 154]
CDF_POINTS = 201  # every CDF series has this many points, its share running evenly from 0 to 1


def test_the_decode_cdf_runs_over_trusted_ttfts_from_the_shortest_decode_to_the_longest(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/decode_cdf_by_model")
    assert rows.series.unique().tolist() == ["model-x"]
    assert rows.rows.unique().tolist() == [len(DECODE_TIMES_S)]
    assert len(rows) == CDF_POINTS
    x_by_share = dict(zip(rows.share, rows.x))
    assert (x_by_share[0.0], x_by_share[0.5], x_by_share[1.0]) == (min(DECODE_TIMES_S), 9, max(DECODE_TIMES_S))


def test_the_decode_cdf_draws_each_of_the_largest_models(connection: duckdb.DuckDBPyConnection,
                                                         fixture_weeks: list[str]) -> None:
    # With the benchmark, `swe-bench`'s two requests on `model-y`, each 10 s with a 1 s TTFT, are a second series.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, "figures/decode_cdf_by_model")
    model_y = rows[rows.series == "model-y"]
    assert model_y.rows.unique().tolist() == [2]
    assert model_y.x.tolist() == pytest.approx([9] * CDF_POINTS)  # quantile_cont interpolates between two 9s


@pytest.mark.parametrize("harnesses", [fixture_release.PAPER_HARNESSES, fixture_release.EVERY_HARNESS])
def test_the_decode_cdf_draws_the_ttft_cdf_s_models(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str],
                                                   harnesses: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, harnesses)
    ttft_rows = site_database.run_query(connection, "figures/ttft_cdf_by_model")
    decode_rows = site_database.run_query(connection, "figures/decode_cdf_by_model")
    assert set(decode_rows.series) == set(ttft_rows.series)


def test_the_decode_median_is_the_median_over_trusted_ttfts(connection: duckdb.DuckDBPyConnection,
                                                            fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/decode_median_by_model")
    assert rows.values.tolist() == [["model-x", len(DECODE_TIMES_S), 9.0]]


# The time of each top-level session of the paper's harnesses in seconds, (prefill, decode, tool, user): its
# requests' prefill and decode with unsplit latency shared out, as the machine time below has them, and its waits for
# a tool or a subagent and for the user. No tool wait reaches the cap. Only `idle-week-2` waits for the user.
AGENTIC_SESSION_TIMES = {
    "tree-root": (20 / 3, 130 / 3, 10 + 70 + 10 + 170, 0),
    "idle-week-1": (3, 172, 20 + 5, 0),
    "mutation": (3, 27, 10 + 170, 0),
    "idle-week-2": (2, 18, 0, 90),
}
TIME_PARTS = ["prefill", "decode", "tool", "user"]


def test_the_session_time_of_four_sessions_is_one_bin_of_their_mean_shares(connection: duckdb.DuckDBPyConnection,
                                                                           fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/session_time_by_part")
    assert len(rows) == 1
    row = rows.iloc[0]
    assert (row.percentile, row.ranked_bin) == (ONE_BIN_PERCENTILE, RANKED_BIN)
    assert (row.bin_sessions, row.rows) == (len(AGENTIC_SESSION_TIMES), len(AGENTIC_SESSION_TIMES))
    means = mean_shares(AGENTIC_SESSION_TIMES)
    assert [row[part] for part in TIME_PARTS] == pytest.approx(means)
    assert [row[f"mean_{part}_share"] for part in TIME_PARTS] == pytest.approx(means)


def test_the_session_time_of_no_weeks_has_no_rows(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [], fixture_release.EVERY_HARNESS)
    assert site_database.run_query(connection, "figures/session_time_by_part").empty


# The machine time of the top-level sessions of the paper's harnesses in seconds, summed: prefill, decode and tool time.
# A request of 10 s with the default trusted TTFT of 1 s is 1 s of prefill and 9 s of decode. `tree-root` has 4 s of
# prefill and 26 s of decode split, and 20 s unsplit (a TTFT of 9.9 s is not under 95% of 10 s; another has none),
# shared by its own ratio 4/30: 4 + 20·4/30 = 20/3 and 26 + 20·26/30 = 130/3. `idle-week-1` 3 and 172 (one request of
# 155 s), `mutation` 3 and 27, `idle-week-2` 2 and 18. Tool time: `tree-root` 10 + 70 + 10 + 170, `idle-week-1` 20 + 5,
# `mutation` 10 + 170; `idle-week-2` waits only for the user, which is not machine time.
AGENTIC_MACHINE_TIME = {"prefill": 20 / 3 + 3 + 3 + 2, "decode": 130 / 3 + 172 + 27 + 18, "tool": 260 + 25 + 180}
SPEEDUP = "figures/speedup_if_twice_as_fast"


def test_the_speedup_of_each_part_is_the_machine_time_over_it_with_that_part_halved(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, SPEEDUP)
    total = sum(AGENTIC_MACHINE_TIME.values())
    assert rows.part.tolist() == ["prefill", "decode", "tool"]
    for part, seconds in AGENTIC_MACHINE_TIME.items():
        assert rows.set_index("part").speedup[part] == pytest.approx(total / (total - seconds / 2)), part
    assert rows.rows.tolist() == [len(AGENTIC_SESSION_TIMES)] * len(AGENTIC_MACHINE_TIME)


def test_the_speedup_of_no_weeks_has_no_rows(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [], fixture_release.EVERY_HARNESS)
    assert site_database.run_query(connection, SPEEDUP).empty


RULES_WEEK = "2026-06-07"  # the week of the rows below
# Requests, (session, harness, step, start s, end s, TTFT ms, waited for), each case of a rule the fixture lacks:
# `capped` waits 1000 s for a tool, more than the cap; `untrusted` has no trusted TTFT, so it takes its harness's
# ratio; `lone` is the only session of its harness and has none either, so it takes the ratio over all sessions;
# `overlapping` starts its second request before its first ends, a negative wait; `person` waits for the user.
RULE_REQUESTS = [
    ("capped", "pi", 0, 0, 10, 1_000, None),
    ("capped", "pi", 1, 1_010, 1_020, 3_000, "tool"),
    ("untrusted", "pi", 0, 0, 10, None, None),
    ("lone", "codex", 0, 0, 20, 19_500, None),
    ("overlapping", "claude-code", 0, 0, 10, 2_000, None),
    ("overlapping", "claude-code", 1, 5, 15, 1_000, "subagent"),
    ("person", "claude-code", 0, 0, 10, 1_000, None),
    ("person", "claude-code", 1, 100, 110, 1_000, "user"),
]
MILLISECONDS_PER_SECOND = 1000


def rule_requests() -> pandas.DataFrame:
    """The rule cases as the site's requests: in session and step order, with the pipeline's waits and trusted TTFTs."""
    requests = pandas.DataFrame(RULE_REQUESTS, columns=["session_id", "harness", "step", "start_s", "end_s", "ttft_ms",
                                                        "waited_for"])
    requests = requests.sort_values(["session_id", "step"], ignore_index=True)
    requests["start_ms"] = requests.start_s * MILLISECONDS_PER_SECOND
    requests["end_ms"] = requests.end_s * MILLISECONDS_PER_SECOND
    requests["ttft_ms"] = requests.ttft_ms.astype("Int64")
    requests["wait_s"] = turns.waits(requests)
    requests["is_trusted_ttft"] = latency.is_trusted_ttft(requests)
    requests["week"] = RULES_WEEK
    requests["is_top_level"] = True
    return requests.drop(columns=["start_s", "end_s"])


def test_the_speedup_caps_tool_waits_and_shares_unsplit_time_as_the_pipeline_does() -> None:
    requests = rule_requests()
    connection = site_database.database_of_rows(pyarrow.Table.from_pandas(requests, preserve_index=False),
                                                pyarrow.table({"week": [RULES_WEEK]}))
    site_database.add_selection_views(connection)
    site_database.select_weeks(connection, [RULES_WEEK], sorted(set(requests.harness)))
    rows = site_database.run_query(connection, SPEEDUP).set_index("part")
    connection.close()
    pipeline = latency.speedups(latency.time_breakdown(requests, cap_tool_waits=True))
    assert rows.speedup.to_dict() == pytest.approx(pipeline)
    assert rows.rows.unique().tolist() == [requests.session_id.nunique()]


def test_the_session_time_shares_unsplit_time_and_leaves_tool_waits_uncapped_as_the_pipeline_does() -> None:
    requests = rule_requests()
    connection = site_database.database_of_rows(pyarrow.Table.from_pandas(requests, preserve_index=False),
                                                pyarrow.table({"week": [RULES_WEEK]}))
    site_database.add_selection_views(connection)
    site_database.select_weeks(connection, [RULES_WEEK], sorted(set(requests.harness)))
    rows = site_database.run_query(connection, "figures/session_time_by_part")
    connection.close()
    pipeline = binning.rank_bins(latency.time_shares(requests), ["human", "tool"]).rename(columns={"human": "user"})
    assert len(rows) == len(pipeline)
    for part in TIME_PARTS:
        assert rows[part].tolist() == pytest.approx(pipeline[part].tolist()), part
