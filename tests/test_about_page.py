"""The About page's hand-written numbers are the ones the code uses: the thin-bin threshold and the paper's prices."""

import pathlib
import re

from paper.metrics import prices

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
ABOUT_PAGE = SITE_FOLDER / "about.html"
CHARTS_MODULE = SITE_FOLDER / "js" / "shared" / "charts.js"  # declares `MIN_ROWS_PER_BIN`


def thin_bin_threshold() -> int:
    """The value of `export const MIN_ROWS_PER_BIN = <number>;` in charts.js."""
    declaration = re.search(r"export const MIN_ROWS_PER_BIN = (\d+);", CHARTS_MODULE.read_text())
    assert declaration is not None, f"{CHARTS_MODULE.name} declares no MIN_ROWS_PER_BIN"
    return int(declaration.group(1))


def test_the_about_page_states_the_thin_bin_threshold() -> None:
    assert f"fewer than {thin_bin_threshold()} rows" in ABOUT_PAGE.read_text()


def test_the_about_page_states_the_paper_s_price_weights() -> None:
    # Cached, uncached and output tokens, written as the page writes them: `1 : 10 : 50`.
    weights = f"{prices.CACHED_PRICE:g} : {prices.UNCACHED_PRICE:g} : {prices.OUTPUT_PRICE:g}"
    assert f"cached, uncached and output at {weights}" in ABOUT_PAGE.read_text()
