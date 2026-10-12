"""The pipeline constants the Prefix-caching figures hold a copy of, to draw, still equal the pipeline's own: the gap
bins in their query and in the browser, the wait causes' names, order and colours, the gap figures' axis limits, the
simulated TTLs, the simulation's scope names and the TTLs the retention figures label, the costs' prices, and the
mutation table's rows and names."""

import math
import pathlib
import re

import pytest

from paper.metrics import cache_costs, gaps, mutations, prices
from paper.prefix_caching import cache_retention, reuse
from release import population
from simulation import cache

import test_pipeline_mirrors

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
GAP_BIN_QUERY = SITE_FOLDER / "queries" / "figures" / "hit_ratio_cdf_by_gap_bin.sql"  # bins the gaps
CAUSE_QUERY = SITE_FOLDER / "queries" / "figures" / "mean_hit_ratio_by_cause.sql"  # orders the causes
CACHING_GAPS_MODULE = SITE_FOLDER / "js" / "figures" / "caching_gaps.js"  # the bins' labels, the causes' names
COLOURS_MODULE = SITE_FOLDER / "js" / "theme" / "colours.js"  # the causes' colours
TIMELINE_BARS_MODULE = SITE_FOLDER / "js" / "session_charts" / "timeline_bars.js"  # the causes a wait bar names
RETENTION_MODULE = SITE_FOLDER / "js" / "figures" / "caching_retention.js"  # the scopes' names, the labelled TTLs
PREFILL_QUERY = SITE_FOLDER / "queries" / "figures" / "prefill_against_storage.sql"  # orders the TTLs, names the scopes
API_COST_QUERY = SITE_FOLDER / "queries" / "figures" / "api_cost_by_ttl.sql"  # the API's prices, the knee
INFRASTRUCTURE_COST_QUERY = SITE_FOLDER / "queries" / "figures" / "infrastructure_cost_by_ttl.sql"  # the provider's
COST_QUERIES = [API_COST_QUERY, INFRASTRUCTURE_COST_QUERY]  # each a multiple of its total at the normalising TTL
TTL_QUERIES = [PREFILL_QUERY, *COST_QUERIES]  # each lists the simulated TTLs with their seconds
MUTATION_QUERY = SITE_FOLDER / "queries" / "figures" / "mutations_by_cause.sql"  # orders the mutation table's rows
OPEN_ENDED = "'infinity'::DOUBLE"  # how the query writes the last bin's upper bound

# A gap bin of the query: `('<label>', <order>, <lower bound>, <upper bound>)`.
GAP_BIN_ROW = re.compile(r"\('([^']+)', (\d+), ([\d.]+), ([\d.]+|'infinity'::DOUBLE)\)")
# A cause of the query: `('<waited_for>', <order>)`.
CAUSE_ROW = re.compile(r"\('(\w+)', (\d+)\)")
# A key and string value of a JavaScript object written on one line or several: `key: "value"`.
OBJECT_ENTRY = re.compile(r'(\w+): "([^"]+)"')
# A TTL of a query: `('<name>', <seconds>)`, the last one's seconds infinite.
TTL_ROW = re.compile(r"\('(\w+)', (\d+|'infinity'::DOUBLE)\)")
# A scope a query names a request's harness by: `THEN '<scope>' ELSE '<scope>'`.
SCOPE_CASE = re.compile(r"THEN '([\w-]+)' ELSE '([\w-]+)'")
# A key of a JavaScript object of TTLs: a quoted name, or the constant `[NO_TTL]`.
TTL_ENTRY = re.compile(r'"([^"]+)":|\[NO_TTL\]:')


def bound(text: str) -> float:
    """A bin bound of the query, in seconds: a number, or the open end."""
    return math.inf if text == OPEN_ENDED else float(text)


def javascript_object(path: pathlib.Path, constant: str) -> dict[str, str]:
    """The entries, in order, of `const <constant> = Object.freeze({ key: "value", … });` in the module at `path`."""
    body = test_pipeline_mirrors.declaration(path, rf"const {constant} = Object\.freeze\(\{{(.*?)\}}\);").group(1)
    return dict(OBJECT_ENTRY.findall(body))


def test_the_query_s_gap_bins_are_the_pipeline_s_in_its_order() -> None:
    rows = GAP_BIN_ROW.findall(GAP_BIN_QUERY.read_text())
    query_bins = [(label, bound(lower), bound(upper)) for label, _order, lower, upper in rows]
    pipeline_bins = [(label, float(lower), float(upper)) for _name, label, lower, upper in gaps.GAP_BINS]
    assert query_bins == pipeline_bins
    assert [int(order) for _label, order, _lower, _upper in rows] == list(range(1, len(gaps.GAP_BINS) + 1))


def test_the_browser_s_gap_bin_labels_are_the_pipeline_s_in_its_order() -> None:
    body = test_pipeline_mirrors.declaration(CACHING_GAPS_MODULE, r"const GAP_BIN_LABELS = Object\.freeze\(\[(.*?)\]\);")
    assert re.findall(r'"([^"]+)"', body.group(1)) == [label for _name, label, _lower, _upper in gaps.GAP_BINS]


def test_the_cause_names_are_the_pipeline_s_in_its_order() -> None:
    assert list(javascript_object(CACHING_GAPS_MODULE, "CAUSE_NAMES").items()) == list(gaps.CAUSE_NAMES.items())


def test_every_cause_has_a_colour_and_the_query_orders_them_as_the_pipeline() -> None:
    assert list(javascript_object(COLOURS_MODULE, "CAUSE_COLOURS")) == list(gaps.CAUSE_NAMES)
    assert [cause for cause, _order in CAUSE_ROW.findall(CAUSE_QUERY.read_text())] == list(gaps.CAUSE_NAMES)


def test_the_timeline_names_the_causes_in_the_pipeline_s_order() -> None:
    assert test_pipeline_mirrors.javascript_object_keys(TIMELINE_BARS_MODULE, "WAIT_CAUSES") == list(gaps.CAUSE_NAMES)


def test_the_gap_figures_axis_limits_are_the_paper_s() -> None:
    for constant in ["MIN_GAP_DRAWN_S", "MAX_GAP_DRAWN_S", "MEAN_HIT_RATIO_AXIS_LOW"]:
        browser_value = test_pipeline_mirrors.javascript_number(CACHING_GAPS_MODULE, constant)
        assert browser_value == getattr(reuse, constant), constant


@pytest.mark.parametrize("path", TTL_QUERIES, ids=lambda path: path.stem)
def test_a_query_s_ttls_are_the_simulation_s_in_its_order(path: pathlib.Path) -> None:
    query_ttls = [(name, bound(seconds)) for name, seconds in TTL_ROW.findall(path.read_text())]
    assert query_ttls == [(name, float(seconds)) for name, seconds in cache.TTLS]


def test_the_prefill_query_names_each_request_s_scope_as_the_pipeline_does() -> None:
    # A request of the benchmark's harness is the benchmark replay's, any other the paper's harnesses'.
    assert SCOPE_CASE.findall(PREFILL_QUERY.read_text()) == [(population.SWE_BENCH, population.AGENTIC)]


def test_the_retention_figures_name_the_scopes_and_the_ttl_none_as_the_pipeline_and_the_paper() -> None:
    scope_names = test_pipeline_mirrors.declaration(RETENTION_MODULE,
                                                    r"const SCOPE_NAMES = Object\.freeze\(\{(.*?)\}\);")
    assert re.findall(r'"?([\w-]+)"?: "', scope_names.group(1)) == [population.AGENTIC, population.SWE_BENCH]
    assert test_pipeline_mirrors.javascript_object_keys(COLOURS_MODULE, "SCOPE_COLOURS") == [
        population.AGENTIC, population.SWE_BENCH]
    assert javascript_string(RETENTION_MODULE, "NO_TTL") == cache_retention.NO_TTL
    assert javascript_string(RETENTION_MODULE, "NO_TTL_LABEL") == cache_retention.TTL_LABELS[cache_retention.NO_TTL]


def test_the_prefill_figure_labels_the_ttls_the_paper_labels_beside_the_benchmark() -> None:
    assert labelled_ttls(population.AGENTIC) == list(cache_retention.HUMAN_TTL_LABELS_BESIDE_BENCHMARK)
    assert labelled_ttls(population.SWE_BENCH) == list(cache_retention.BENCHMARK_TTL_LABELS)


def javascript_string(path: pathlib.Path, constant: str) -> str:
    """The value of `const <constant> = "<text>";` in the module at `path`."""
    return test_pipeline_mirrors.declaration(path, rf'const {constant} = "([^"]+)";').group(1)


def labelled_ttls(scope: str) -> list[str]:
    """The TTLs `LABELLED_TTLS` of caching_retention.js places a name beside for `scope`, in order, `[NO_TTL]` read as
    the TTL it names."""
    body = test_pipeline_mirrors.declaration(RETENTION_MODULE, rf'"?{scope}"?: Object\.freeze\(\{{(.*?)\}}\)').group(1)
    no_ttl = javascript_string(RETENTION_MODULE, "NO_TTL")
    return [name if name else no_ttl for name in TTL_ENTRY.findall(body)]


def test_the_api_cost_s_prices_and_knee_are_the_pipeline_s() -> None:
    assert test_pipeline_mirrors.sql_number(API_COST_QUERY, "cached_price") == prices.CACHED_PRICE
    assert test_pipeline_mirrors.sql_number(API_COST_QUERY, "uncached_price") == prices.UNCACHED_PRICE
    assert test_pipeline_mirrors.sql_number(API_COST_QUERY, "output_price") == prices.OUTPUT_PRICE
    assert test_pipeline_mirrors.sql_number(API_COST_QUERY, "knee_tolerance") == cache_costs.KNEE_TOLERANCE


def test_the_infrastructure_cost_s_prices_are_the_pipeline_s() -> None:
    assert test_pipeline_mirrors.sql_number(INFRASTRUCTURE_COST_QUERY, "recompute_price") == prices.RECOMPUTE_PRICE
    storage_price = test_pipeline_mirrors.sql_number(INFRASTRUCTURE_COST_QUERY, "storage_price_per_day")
    assert storage_price == prices.STORAGE_PRICE_PER_DAY
    assert test_pipeline_mirrors.sql_number(INFRASTRUCTURE_COST_QUERY, "seconds_per_day") == prices.SECONDS_PER_DAY


@pytest.mark.parametrize("path", COST_QUERIES, ids=lambda path: path.stem)
def test_a_cost_is_counted_per_million_tokens_and_normalised_at_the_pipeline_s_ttl(path: pathlib.Path) -> None:
    assert test_pipeline_mirrors.sql_number(path, "tokens_per_million") == prices.TOKENS_PER_MILLION
    normalising_ttl = test_pipeline_mirrors.declaration(path, r"'(\w+)' AS normalising_ttl").group(1)
    assert normalising_ttl == cache_costs.NORMALISING_TTL
    assert test_pipeline_mirrors.declaration(path, r"WHERE scope = '([\w-]+)'").group(1) == population.AGENTIC


def test_a_cost_figure_s_callout_rises_as_the_paper_s() -> None:
    rise = test_pipeline_mirrors.javascript_number(RETENTION_MODULE, "CALLOUT_RISE_SHARE")
    assert rise == cache_retention.CALLOUT_RISE_SHARE


def test_the_mutation_table_s_rows_are_the_pipeline_s_in_its_order() -> None:
    query_rows = CAUSE_ROW.findall(MUTATION_QUERY.read_text())
    assert [name for name, _order in query_rows] == [name for name, _label in mutations.TABLE_ROWS]
    assert [int(order) for _name, order in query_rows] == list(range(1, len(mutations.TABLE_ROWS) + 1))
    names = javascript_object(CACHING_GAPS_MODULE, "MUTATION_TABLE_ROWS")
    assert list(names.items()) == list(mutations.TABLE_ROWS)
