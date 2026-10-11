"""The About page's hand-written numbers and lists are the ones the code uses: the default harnesses, the count of
figures, the gap bins, the wait causes, the idle-gap bins, the thin-bin threshold, the prices and the release's and
the simulation's named values. The page names no scope and links to the figures on the Explore page."""

import html
import pathlib
import re

from paper.metrics import gaps, latency, prices
from release import population, schema
from simulation import cache

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
ABOUT_PAGE = SITE_FOLDER / "about.html"
CHARTS_MODULE = SITE_FOLDER / "js" / "shared" / "charts.js"  # declares `MIN_ROWS_PER_BIN`
FIGURE_MODULES = SITE_FOLDER / "js" / "figures"  # every figure entry, one `query: "figures/<name>"` each
FIGURE_ENTRY_QUERY = re.compile(r'query: "figures/\w+"')
NUMBER_WORDS = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten")


def about_page() -> str:
    """The About page's HTML."""
    return ABOUT_PAGE.read_text()


def definition(term: str) -> str:
    """The HTML of the definition that follows `<dt id="<term>">` on the About page."""
    found = re.search(rf'<dt id="{term}">.*?</dt>\s*<dd>(.*?)</dd>', about_page(), re.DOTALL)
    assert found is not None, f"the About page defines no {term}"
    return found.group(1)


def codes(text: str) -> list[str]:
    """The text of each `<code>` element of `text`, in order, with its entities decoded."""
    return [html.unescape(code) for code in re.findall(r"<code>(.*?)</code>", text)]


def listed(names: list[str]) -> str:
    """The names as prose writes them: "a, b and c"."""
    return ", ".join(names[:-1]) + " and " + names[-1]


def thin_bin_threshold() -> int:
    """The value of `export const MIN_ROWS_PER_BIN = <number>;` in charts.js."""
    declaration = re.search(r"export const MIN_ROWS_PER_BIN = (\d+);", CHARTS_MODULE.read_text())
    assert declaration is not None, f"{CHARTS_MODULE.name} declares no MIN_ROWS_PER_BIN"
    return int(declaration.group(1))


def figure_count() -> int:
    """How many figure entries the Explore page's figure modules list."""
    entries = 0
    for module in sorted(FIGURE_MODULES.glob("*.js")):
        entries += len(FIGURE_ENTRY_QUERY.findall(module.read_text()))
    return entries


def test_the_about_page_names_the_benchmark_harness_the_default_leaves_out() -> None:
    assert f"every harness but <code>{population.BENCHMARK_HARNESS}</code>" in about_page()
    assert codes(definition("harness"))[-1] == population.BENCHMARK_HARNESS


def test_the_about_page_counts_the_explore_page_s_figures_and_links_to_them() -> None:
    assert f'<a href="index.html#figures-sessions">{figure_count()} figures of the paper</a>' in about_page()


def test_the_about_page_names_no_scope_and_no_figures_page() -> None:
    assert re.search(r"\bscope", about_page(), re.IGNORECASE) is None
    assert "figures.html" not in about_page()


def test_the_about_page_s_gap_bins_are_the_pipeline_s() -> None:
    labels = [label for _name, label, _lower, _upper in gaps.GAP_BINS]
    assert f"One of {NUMBER_WORDS[len(labels)]} bins" in definition("gap-bin")
    assert codes(definition("gap-bin")) == labels


def test_the_about_page_s_wait_causes_are_the_paper_s_names_in_its_order() -> None:
    names = list(gaps.CAUSE_NAMES.values())
    assert f"names these {NUMBER_WORDS[len(names)]} causes {listed(names)};" in definition("wait")


def test_the_about_page_s_idle_gap_bins_are_the_pipeline_s() -> None:
    edges = gaps.IDLE_GAP_EDGES_S
    bins = len(edges) - 1
    widening = (edges[-1] / edges[0]) ** (1 / bins)
    stated = f"{bins} bins from {edges[0]:g} s to {edges[-1] / 3600:g} h, each {widening:.2f} times as wide"
    assert stated in definition("idle-gap")
    assert f"merges an idle-gap bin of fewer than {gaps.MIN_ROWS_PER_IDLE_GAP_GROUP} requests" in about_page()


def test_the_about_page_states_the_thin_bin_threshold() -> None:
    assert f"fewer than {thin_bin_threshold()} rows" in about_page()


def test_the_about_page_states_the_paper_s_price_weights() -> None:
    # Cached, uncached and output tokens, written as the page writes them: `1 : 10 : 50`.
    weights = f"{prices.CACHED_PRICE:g} : {prices.UNCACHED_PRICE:g} : {prices.OUTPUT_PRICE:g}"
    assert f"cached, uncached and output at {weights}" in about_page()


def test_the_about_page_s_trusted_ttft_share_is_the_pipeline_s() -> None:
    assert f"under {latency.TRUSTED_TTFT_SHARE:.0%} of the request's latency" in definition("ttft")


def test_the_about_page_s_release_lists_are_the_release_s() -> None:
    assert codes(definition("finish-reason")) == list(schema.FINISH_REASONS)
    assert codes(definition("outcome")) == list(schema.OUTCOMES)
    assert codes(definition("context-mutation")) == list(schema.CAUSES)
    assert f"Transition: {', '.join(schema.TRANSITIONS)}</dt>" in about_page()
    for category in schema.TOOL_CATEGORIES:
        assert category in definition("category"), category


def test_the_about_page_s_simulation_values_are_the_simulation_s() -> None:
    assert f"the {cache.BLOCK_TOKENS}-token blocks" in definition("cache-simulation")
    assert codes(definition("policy")) == list(cache.POLICIES)
