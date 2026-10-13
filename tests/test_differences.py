"""`docs/differences.md`, the list of where the site draws more simply than the paper, holds the queries', the
browser's and the pipeline's numbers; and no figure's definition names the paper, since the list says how each
differs."""

import pathlib
import re

import paper.sessions.latency
from paper.metrics import gaps, prices
from paper.prefix_caching import reuse

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIFFERENCES = ROOT / "docs" / "differences.md"
SITE_FOLDER = ROOT / "site"
CHARTS_MODULE = SITE_FOLDER / "js" / "shared" / "charts.js"  # declares `MIN_ROWS_PER_BIN`
COLOURS_MODULE = SITE_FOLDER / "js" / "theme" / "colours.js"  # declares `SERIES_SLOTS`, the eight series colours
# The folders of every figure entry: the section modules and theirs, the cache simulation's and the scope comparisons'.
FIGURE_FOLDERS = [SITE_FOLDER / "js" / folder for folder in ("figures", "simulation", "comparison")]
# A figure entry's title, then its insight, then its definition, in that order.
FIGURE_TITLE_AND_DEFINITION = re.compile(r'title: "([^"]+)",\s*insight: "[^"]+",\s*definition: "([^"]+)"')
FIGURE_ENTRY_QUERY = re.compile(r'query: "(?:figures|explore)/\w+"')  # one per figure entry, a chart's or a histogram's
# The phrase a figure's definition may use that names the paper: the population, not a difference from the paper.
PAPER_POPULATION = "the paper's harnesses"
FIGURE_QUERIES = SITE_FOLDER / "queries" / "figures"
MODEL_QUERIES = [FIGURE_QUERIES / "ttft_cdf_by_model.sql", FIGURE_QUERIES / "decode_cdf_by_model.sql"]
IDLE_GAP_TITLE = "Cache reuse by provider"
NUMBER_WORDS = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten")


def differences() -> str:
    """The text of `docs/differences.md`, its lines joined by single spaces, as Markdown reads a wrapped line."""
    return " ".join(DIFFERENCES.read_text().split())


def difference_item(title: str) -> str:
    """The item of the list that names the figure titled `title` first, up to the next item."""
    found = re.search(rf"- \*\*{re.escape(title)}\*\*.*?(?= - |$)", differences())
    assert found is not None, f"the list of differences names no {title}"
    return found.group(0)


def figure_titles_and_definitions() -> list[tuple[str, str]]:
    """Every figure entry's title and definition, from the Explore page's figure modules."""
    entries = []
    for folder in FIGURE_FOLDERS:
        for module in sorted(folder.glob("*.js")):
            entries.extend(FIGURE_TITLE_AND_DEFINITION.findall(module.read_text()))
    return entries


def figure_definition(title: str) -> str:
    """The definition of the figure entry titled `title`."""
    definitions = [definition for entry_title, definition in figure_titles_and_definitions() if entry_title == title]
    assert len(definitions) == 1, f"no single figure is titled {title}"
    return definitions[0]


def names_the_paper(definition: str) -> bool:
    """Whether a figure's definition names the paper other than as the population of the paper's harnesses."""
    return "the paper" in definition.replace(PAPER_POPULATION, "")


def model_limit(path: pathlib.Path) -> int:
    """The number of models the query keeps: the value of its `LIMIT`."""
    found = re.search(r"\bLIMIT (\d+)", path.read_text())
    assert found is not None, f"{path.name} has no LIMIT"
    return int(found.group(1))


def javascript_constant(path: pathlib.Path, pattern: str) -> str:
    """The first group of `pattern` in the module at `path`."""
    found = re.search(pattern, path.read_text(), re.DOTALL)
    assert found is not None, f"{path.name} has no match for {pattern}"
    return found.group(1)


def series_slot_count() -> int:
    """How many series colours `SERIES_SLOTS` lists: a line past that many would be in the Other grey."""
    slots = javascript_constant(COLOURS_MODULE, r"export const SERIES_SLOTS = Object\.freeze\(\[(.*?)\]\);")
    return len(re.findall(r'"var\(--series-\d+\)"', slots))


def test_no_figure_definition_names_the_paper() -> None:
    entries = figure_titles_and_definitions()
    modules = [module for folder in FIGURE_FOLDERS for module in folder.glob("*.js")]
    assert len(entries) == sum(len(FIGURE_ENTRY_QUERY.findall(module.read_text())) for module in modules)
    for title, definition in entries:
        assert not names_the_paper(definition), title


def test_the_list_leaves_out_what_the_paper_does_too() -> None:
    assert "**Cache reuse after context changes**" not in differences()


def test_the_thin_bins_are_the_browser_s_and_the_pipeline_s() -> None:
    threshold = javascript_constant(CHARTS_MODULE, r"export const MIN_ROWS_PER_BIN = (\d+);")
    assert f"a bin with fewer than {threshold} rows is hidden" in differences()
    assert f"merges an idle-gap bin of fewer than {gaps.MIN_ROWS_PER_IDLE_GAP_GROUP} requests" in differences()


def test_the_prices_are_the_pipeline_s() -> None:
    weights = f"{prices.CACHED_PRICE:g} : {prices.UNCACHED_PRICE:g} : {prices.OUTPUT_PRICE:g}"
    assert f"cached, uncached and output at {weights}" in differences()


def test_the_models_and_providers_are_the_queries_and_the_paper_s() -> None:
    limits = {model_limit(path) for path in MODEL_QUERIES}
    assert len(limits) == 1, "the TTFT and decode figures keep as many models"
    assert f"the {NUMBER_WORDS[limits.pop()]} models with most requests" in differences()
    assert f"the paper draws {NUMBER_WORDS[len(paper.sessions.latency.MODELS)]} fixed models" in differences()
    assert f"shows the {NUMBER_WORDS[reuse.PROVIDERS_DRAWN]} providers with most idle gaps" in differences()
    assert f"that are among the {NUMBER_WORDS[series_slot_count()]} with most requests over every week" in differences()


def test_the_idle_gap_providers_are_those_the_figure_draws() -> None:
    drawn = f"the {NUMBER_WORDS[series_slot_count()]} providers with most requests"
    assert f"the {NUMBER_WORDS[series_slot_count()]} busiest providers" in figure_definition(IDLE_GAP_TITLE).lower()
    assert f"a line for each of {drawn}" in difference_item(IDLE_GAP_TITLE)
