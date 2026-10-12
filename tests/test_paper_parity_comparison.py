"""The site's Benchmark-against-production figures give the paper's numbers: each share of a tool group in the first
and the last tenth of a turn that `numbers.json` quotes, human-driven and benchmark, equals the tool mix's.

The query runs as the browser runs it, on the full site data with every week and the paper's harnesses selected,
through the fixtures `agentic` and `paper_numbers` of `conftest.py`; its benchmark scope is the benchmark harness's
sessions whatever harnesses are selected. Like `test_paper_parity.py`, these tests are skipped when the full site data
or `numbers.json` is missing.
"""

import duckdb
import pandas

import site_database
from paper.metrics import trajectories
from test_paper_parity import RELATIVE_TOLERANCE, Comparison, assert_match

SECTION = "benchmark_vs_production"
# The item of `numbers.json` that quotes each scope of the tool mix, by the scope's name in the query.
TOOL_MIX_ITEMS = {"human-driven": "trajectory_mix_human", "benchmark": "trajectory_mix_benchmark"}
# The tenth each quoted share is of, by the suffix of its name: `<group>_share_first_tenth` and `…_last_tenth`.
QUOTED_TENTHS = {"_share_first_tenth": 0, "_share_last_tenth": 9}
PAPER_SCOPE = "Agentic and SWE-Bench"  # the scope `numbers.json` records with both items: the two scopes compared


def test_the_paper_counts_the_tool_mix_in_both_scopes(paper_numbers: dict) -> None:
    for item in TOOL_MIX_ITEMS.values():
        assert paper_numbers[SECTION][item]["scope"] == PAPER_SCOPE, item


def group_share(rows: pandas.DataFrame, scope: str, tenth: int, group: str) -> float:
    """The share of `group` in a scope's tenth of the tool mix; zero when the tenth holds no call of it."""
    found = rows[(rows.scope == scope) & (rows.tenth == tenth) & (rows.tool_group == group)]
    assert len(found) <= 1, f"{scope} has {len(found)} rows of {group} in tenth {tenth}"
    return float(found.share.iloc[0]) if len(found) == 1 else 0.0


def test_the_tool_mix_in_the_first_and_last_tenth(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/tool_mix_by_turn_position`'s `share` of each scope, tenth and group against
    # `benchmark_vs_production.trajectory_mix_<human|benchmark>.<group>_share_<first|last>_tenth`.
    rows = site_database.run_query(agentic, "figures/tool_mix_by_turn_position")
    comparisons = []
    for scope, item in TOOL_MIX_ITEMS.items():
        for name in paper_numbers[SECTION][item]:
            for suffix, tenth in QUOTED_TENTHS.items():
                if name.endswith(suffix):
                    share = group_share(rows, scope, tenth, name.removesuffix(suffix))
                    comparisons.append(Comparison(SECTION, item, name, share, RELATIVE_TOLERANCE))
    assert len(comparisons) == len(TOOL_MIX_ITEMS) * len(QUOTED_TENTHS) * len(trajectories.GROUPS)
    assert_match(paper_numbers, comparisons)
