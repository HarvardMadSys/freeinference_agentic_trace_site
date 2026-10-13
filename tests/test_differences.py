"""No figure's definition names the paper: a definition says what the site draws, and README's "Where the numbers
come from" says where that differs from the paper."""

import pathlib
import re

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
# The folders of every figure entry: the section modules and theirs, the cache simulation's and the scope comparisons'.
FIGURE_FOLDERS = [SITE_FOLDER / "js" / folder for folder in ("figures", "simulation", "comparison")]
# A figure entry's title, then its insight, then its definition, in that order.
FIGURE_TITLE_AND_DEFINITION = re.compile(r'title: "([^"]+)",\s*insight: "[^"]+",\s*definition: "([^"]+)"')
FIGURE_ENTRY_QUERY = re.compile(r'query: "(?:figures|explore)/\w+"')  # one per figure entry, a chart's or a histogram's
# The phrase a figure's definition may use that names the paper: the population, not a difference from the paper.
PAPER_POPULATION = "the paper's harnesses"


def figure_titles_and_definitions() -> list[tuple[str, str]]:
    """Every figure entry's title and definition, from the Explore page's figure modules."""
    entries = []
    for folder in FIGURE_FOLDERS:
        for module in sorted(folder.glob("*.js")):
            entries.extend(FIGURE_TITLE_AND_DEFINITION.findall(module.read_text()))
    return entries


def names_the_paper(definition: str) -> bool:
    """Whether a figure's definition names the paper other than as the population of the paper's harnesses."""
    return "the paper" in definition.replace(PAPER_POPULATION, "")


def test_no_figure_definition_names_the_paper() -> None:
    entries = figure_titles_and_definitions()
    modules = [module for folder in FIGURE_FOLDERS for module in folder.glob("*.js")]
    assert len(entries) == sum(len(FIGURE_ENTRY_QUERY.findall(module.read_text())) for module in modules)
    for title, definition in entries:
        assert not names_the_paper(definition), title
