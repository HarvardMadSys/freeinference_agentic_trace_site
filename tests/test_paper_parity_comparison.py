"""The site's Human-driven-against-benchmark figures give the paper's numbers: each scope CDF's two medians and their
ratio equal the paper's, and each share of a tool group in the first and the last tenth of a turn that `numbers.json`
quotes, human-driven and benchmark, equals the tool mix's.

The numbers are read from the shipped answers, which `make data` wrote with every week and the paper's harnesses
selected; their benchmark scope is the benchmark harness's sessions whatever harnesses are selected. Like
`test_paper_parity.py`, these tests are skipped when the shipped answers or `numbers.json` is missing.
"""

import pandas

from paper.metrics import trajectories
from release import population
from test_paper_parity import RELATIVE_TOLERANCE, Comparison, answer, assert_match

SECTION = "benchmark_vs_production"
# The item of `numbers.json` that quotes each scope of the tool mix, by the scope's name in the query.
TOOL_MIX_ITEMS = {population.AGENTIC: "trajectory_mix_human", population.SWE_BENCH: "trajectory_mix_benchmark"}
# The tenth each quoted share is of, by the suffix of its name: `<group>_share_first_tenth` and `…_last_tenth`.
QUOTED_TENTHS = {"_share_first_tenth": 0, "_share_last_tenth": 9}
PAPER_SCOPE = "Agentic and SWE-Bench"  # the scope `numbers.json` records with every item: the two scopes compared
# The item of `numbers.json` that gives each scope CDF's medians and their ratio, by the CDF's query.
SCOPE_CDF_ITEMS = {
    "figures/turn_duration_by_scope": "turn_duration",
    "figures/session_duration_by_scope": "session_duration",
    "figures/input_per_request_by_scope": "input_per_request",
    "figures/user_prompt_tokens_by_scope": "user_prompt_size",
}
# The name of each scope's median in those items, by the scope's name in the queries.
MEDIAN_NAMES = {population.AGENTIC: "median_human", population.SWE_BENCH: "median_benchmark"}


def test_the_paper_counts_every_compared_item_in_both_scopes(paper_numbers: dict) -> None:
    for item in [*TOOL_MIX_ITEMS.values(), *SCOPE_CDF_ITEMS.values()]:
        assert paper_numbers[SECTION][item]["scope"] == PAPER_SCOPE, item


def test_the_medians_of_each_scope_cdf_and_their_ratio(paper_numbers: dict) -> None:
    # Each scope CDF's `median` of each scope, and its `median_ratio`, against
    # `benchmark_vs_production.<item>.median_human`, `.median_benchmark` and `.ratio`.
    comparisons = []
    for query, item in SCOPE_CDF_ITEMS.items():
        rows = answer(query)
        for scope, name in MEDIAN_NAMES.items():
            median = float(rows[rows.series == scope]["median"].iloc[0])
            comparisons.append(Comparison(SECTION, item, name, median, RELATIVE_TOLERANCE))
        comparisons.append(Comparison(SECTION, item, "ratio", float(rows.median_ratio.iloc[0]), RELATIVE_TOLERANCE))
    assert_match(paper_numbers, comparisons)


def group_share(rows: pandas.DataFrame, scope: str, tenth: int, group: str) -> float:
    """The share of `group` in a scope's tenth of the tool mix; zero when the tenth holds no call of it."""
    found = rows[(rows.scope == scope) & (rows.tenth == tenth) & (rows.tool_group == group)]
    assert len(found) <= 1, f"{scope} has {len(found)} rows of {group} in tenth {tenth}"
    return float(found.share.iloc[0]) if len(found) == 1 else 0.0


def test_the_tool_mix_in_the_first_and_last_tenth(paper_numbers: dict) -> None:
    # `figures/tool_mix_by_turn_position`'s `share` of each scope, tenth and group against
    # `benchmark_vs_production.trajectory_mix_<human|benchmark>.<group>_share_<first|last>_tenth`.
    rows = answer("figures/tool_mix_by_turn_position")
    comparisons = []
    for scope, item in TOOL_MIX_ITEMS.items():
        for name in paper_numbers[SECTION][item]:
            for suffix, tenth in QUOTED_TENTHS.items():
                if name.endswith(suffix):
                    share = group_share(rows, scope, tenth, name.removesuffix(suffix))
                    comparisons.append(Comparison(SECTION, item, name, share, RELATIVE_TOLERANCE))
    assert len(comparisons) == len(TOOL_MIX_ITEMS) * len(QUOTED_TENTHS) * len(trajectories.GROUPS)
    assert_match(paper_numbers, comparisons)
