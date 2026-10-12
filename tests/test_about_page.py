"""The About page's hand-written numbers and lists are the ones the code uses: the default harnesses, the count of
figures, the gap bins, the wait causes, the idle-gap bins, the thin-bin threshold, the prices, the models and
providers the figures draw, and the release's and the simulation's named values. Its list of where the site draws
more simply than the paper names every figure whose definition states a difference. The page names no scope and
links to the figures on the Explore page."""

import html
import pathlib
import re

import paper.sessions.latency
from paper.metrics import gaps, latency, prices, trajectories
from paper.prefix_caching import reuse
from release import population, schema
from simulation import cache

import site_data.simulation

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
ABOUT_PAGE = SITE_FOLDER / "about.html"
CHARTS_MODULE = SITE_FOLDER / "js" / "shared" / "charts.js"  # declares `MIN_ROWS_PER_BIN`
COLOURS_MODULE = SITE_FOLDER / "js" / "theme" / "colours.js"  # declares `SERIES_SLOTS`, the eight series colours
IDLE_GAP_TITLE = "Hit ratio after an idle gap"
# The folders of every figure entry, one `query: "figures/<name>"` each: the first three sections', and the
# Benchmark-against-production section's.
FIGURE_FOLDERS = [SITE_FOLDER / "js" / "figures", SITE_FOLDER / "js" / "comparison"]
FIGURE_ENTRY_QUERY = re.compile(r'query: "figures/\w+"')
FIGURE_TITLE_AND_DEFINITION = re.compile(r'title: "([^"]+)",\s*definition: "([^"]+)"')
# Phrases of a figure's definition that name the paper without stating a difference from it.
SAME_AS_THE_PAPER = ("as in the paper", "the paper's harnesses")
FIGURE_QUERIES = SITE_FOLDER / "queries" / "figures"
MODEL_QUERIES = [FIGURE_QUERIES / "ttft_cdf_by_model.sql", FIGURE_QUERIES / "decode_cdf_by_model.sql"]
NUMBER_WORDS = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten")
# The figure queries that restate a pipeline definition in SQL, each with its figure's title.
RESTATING_QUERIES = {
    "cost_share_by_session": "Cost share by session",
    "session_time_by_part": "Session time by part",
    "speedup_if_twice_as_fast": "Speed-up if twice as fast",
    "calls_per_request_by_category": "Calls per request by category",
    "latency_by_batch_width": "Tool latency by batch width",
    "tool_mix_by_turn_position": "Tool mix along a turn",
    "mutations_by_cause": "Context mutations by cause",
    "prefill_against_storage": "Prefill against storage",
    "api_cost_by_ttl": "API cost by TTL",
    "infrastructure_cost_by_ttl": "Infrastructure cost by TTL",
}
MIRROR_TESTS = sorted(pathlib.Path(__file__).resolve().parent.glob("test_pipeline_mirrors*.py"))  # read the copies
RESTATING_SENTENCE = "Where a query restates one in SQL"  # opens the one passage naming the restating queries


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


def simpler_than_the_paper() -> str:
    """The HTML of the About page's list of where the site draws more simply than the paper."""
    found = re.search(r'id="simpler-than-the-paper".*?</ul>', about_page(), re.DOTALL)
    assert found is not None, "the About page has no list of where the site draws more simply than the paper"
    return found.group(0)


def figure_modules() -> list[pathlib.Path]:
    """The Explore page's figure modules, folder by folder."""
    modules = []
    for folder in FIGURE_FOLDERS:
        modules.extend(sorted(folder.glob("*.js")))
    return modules


def figure_titles_and_definitions() -> list[tuple[str, str]]:
    """Every figure entry's title and definition, from the Explore page's figure modules."""
    entries = []
    for module in figure_modules():
        entries.extend(FIGURE_TITLE_AND_DEFINITION.findall(module.read_text()))
    return entries


def differs_from_the_paper(definition: str) -> bool:
    """Whether a figure's definition names the paper other than to say it does the same."""
    remaining = definition
    for phrase in SAME_AS_THE_PAPER:
        remaining = remaining.replace(phrase, "")
    return "the paper" in remaining


def model_limit(path: pathlib.Path) -> int:
    """The number of models the query keeps: the value of its `LIMIT`."""
    found = re.search(r"\bLIMIT (\d+)", path.read_text())
    assert found is not None, f"{path.name} has no LIMIT"
    return int(found.group(1))


def thin_bin_threshold() -> int:
    """The value of `export const MIN_ROWS_PER_BIN = <number>;` in charts.js."""
    declaration = re.search(r"export const MIN_ROWS_PER_BIN = (\d+);", CHARTS_MODULE.read_text())
    assert declaration is not None, f"{CHARTS_MODULE.name} declares no MIN_ROWS_PER_BIN"
    return int(declaration.group(1))


def series_slot_count() -> int:
    """How many series colours `SERIES_SLOTS` in colours.js lists: a line past that many would be in the Other grey."""
    declaration = re.search(r"export const SERIES_SLOTS = Object\.freeze\(\[(.*?)\]\);", COLOURS_MODULE.read_text(),
                            re.DOTALL)
    assert declaration is not None, f"{COLOURS_MODULE.name} declares no SERIES_SLOTS"
    return len(re.findall(r'"var\(--series-\d+\)"', declaration.group(1)))


def figure_definition(title: str) -> str:
    """The definition of the figure entry titled `title`."""
    definitions = [definition for entry_title, definition in figure_titles_and_definitions() if entry_title == title]
    assert len(definitions) == 1, f"no single figure is titled {title}"
    return definitions[0]


def difference_item(title: str) -> str:
    """The HTML of the item of the About page's list of differences that names the figure titled `title`."""
    found = re.search(rf"<li><strong>{title}</strong>.*?</li>", simpler_than_the_paper(), re.DOTALL)
    assert found is not None, f"the list of differences names no {title}"
    return found.group(0)


def figure_count() -> int:
    """How many figure entries the Explore page's figure modules list."""
    entries = 0
    for module in figure_modules():
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


def test_the_speedup_states_the_pipeline_s_tool_wait_cap() -> None:
    minutes = latency.TOOL_GAP_CAP_S / 60  # seconds to the minute
    assert f"a tool wait counts for at most {minutes:g} minutes" in figure_definition("Speed-up if twice as fast")


def test_the_about_page_s_release_lists_are_the_release_s() -> None:
    assert codes(definition("finish-reason")) == list(schema.FINISH_REASONS)
    assert codes(definition("outcome")) == list(schema.OUTCOMES)
    assert codes(definition("context-mutation")) == list(schema.CAUSES)
    assert f"Transition: {', '.join(schema.TRANSITIONS)}</dt>" in about_page()
    for category in schema.TOOL_CATEGORIES:
        assert category in definition("category"), category


def test_the_about_page_s_tool_groups_are_the_pipeline_s() -> None:
    assert f"draws: {listed(list(trajectories.GROUPS))}." in definition("tool-group")
    for category, group in trajectories.GROUP_OF_CATEGORY.items():
        named = f"{category} calls are in {group}" in definition("tool-group")
        assert named or f"{category} calls in {group}" in definition("tool-group"), category


def test_the_about_page_s_simulation_values_are_the_simulation_s() -> None:
    assert f"the {cache.BLOCK_TOKENS}-token blocks" in definition("cache-simulation")
    assert codes(definition("policy")) == [site_data.simulation.KEPT_POLICY]
    assert f"simulates {NUMBER_WORDS[len(cache.POLICIES)]} policies" in definition("policy")


def test_the_list_of_differences_names_every_figure_whose_definition_states_one() -> None:
    entries = figure_titles_and_definitions()
    assert len(entries) == figure_count()
    for title, definition in entries:
        if differs_from_the_paper(definition):
            assert f"<strong>{title}</strong>" in simpler_than_the_paper(), title


def test_the_list_of_differences_leaves_out_what_the_paper_does_too() -> None:
    assert "Hit ratio after a context change" not in simpler_than_the_paper()


def test_the_about_page_s_models_and_providers_are_the_queries_and_the_paper_s() -> None:
    limits = {model_limit(path) for path in MODEL_QUERIES}
    assert len(limits) == 1, "the TTFT and decode figures keep as many models"
    assert f"the {NUMBER_WORDS[limits.pop()]} models with most requests" in simpler_than_the_paper()
    assert f"the paper draws {NUMBER_WORDS[len(paper.sessions.latency.MODELS)]} fixed models" in simpler_than_the_paper()
    assert f"shows the {NUMBER_WORDS[reuse.PROVIDERS_DRAWN]} providers with most idle gaps" in simpler_than_the_paper()
    slotted = NUMBER_WORDS[series_slot_count()]
    assert f"that are among the {slotted} with most requests over every week" in simpler_than_the_paper()


def test_the_about_page_s_idle_gap_providers_are_those_the_figure_draws() -> None:
    drawn = f"the {NUMBER_WORDS[series_slot_count()]} providers with most requests"
    assert drawn in figure_definition(IDLE_GAP_TITLE)
    assert f"a line for each of {drawn}" in difference_item(IDLE_GAP_TITLE)


def test_the_about_page_names_every_query_restating_a_definition_and_a_mirror_test_reads_each() -> None:
    mirror_text = "".join(path.read_text() for path in MIRROR_TESTS)
    passages = [paragraph for paragraph in re.findall(r"<p>(.*?)</p>", about_page(), re.DOTALL)
                if RESTATING_SENTENCE in paragraph]
    assert len(passages) == 1, "the restating queries are named once, in How the data were built"
    assert f"{NUMBER_WORDS[len(RESTATING_QUERIES)]} queries do" in passages[0]
    for title in RESTATING_QUERIES.values():
        assert f"<strong>{title}</strong>" in passages[0], title
    for query, title in RESTATING_QUERIES.items():
        assert f"{query}.sql" in mirror_text, query
        assert figure_definition(title)


def test_the_about_page_defines_nothing_the_simulation_figures_no_longer_draw() -> None:
    assert "simulated hit ratio" not in about_page()
    assert "Active token-seconds" not in about_page()
