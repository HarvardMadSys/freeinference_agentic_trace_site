"""The pipeline constants the Prefix-caching figures hold a copy of, to draw, still equal the pipeline's own: the gap
bins in their query and in the browser, the wait causes' names, order and colours, and the gap figures' axis limits."""

import math
import pathlib
import re

from paper.metrics import gaps
from paper.prefix_caching import reuse

import test_pipeline_mirrors

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
GAP_BIN_QUERY = SITE_FOLDER / "queries" / "figures" / "hit_ratio_cdf_by_gap_bin.sql"  # bins the gaps
CAUSE_QUERY = SITE_FOLDER / "queries" / "figures" / "mean_hit_ratio_by_cause.sql"  # orders the causes
CACHING_GAPS_MODULE = SITE_FOLDER / "js" / "figures" / "caching_gaps.js"  # the bins' labels, the causes' names
CHARTS_MODULE = SITE_FOLDER / "js" / "shared" / "charts.js"  # the causes' colours
OPEN_ENDED = "'infinity'::DOUBLE"  # how the query writes the last bin's upper bound

# A gap bin of the query: `('<label>', <order>, <lower bound>, <upper bound>)`.
GAP_BIN_ROW = re.compile(r"\('([^']+)', (\d+), ([\d.]+), ([\d.]+|'infinity'::DOUBLE)\)")
# A cause of the query: `('<waited_for>', <order>)`.
CAUSE_ROW = re.compile(r"\('(\w+)', (\d+)\)")
# A key and string value of a JavaScript object written on one line or several: `key: "value"`.
OBJECT_ENTRY = re.compile(r'(\w+): "([^"]+)"')


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
    assert list(javascript_object(CHARTS_MODULE, "CAUSE_COLOURS")) == list(gaps.CAUSE_NAMES)
    assert [cause for cause, _order in CAUSE_ROW.findall(CAUSE_QUERY.read_text())] == list(gaps.CAUSE_NAMES)


def test_the_gap_figures_axis_limits_are_the_paper_s() -> None:
    for constant in ["MIN_GAP_DRAWN_S", "MAX_GAP_DRAWN_S", "MEAN_HIT_RATIO_AXIS_LOW"]:
        browser_value = test_pipeline_mirrors.javascript_number(CACHING_GAPS_MODULE, constant)
        assert browser_value == getattr(reuse, constant), constant
