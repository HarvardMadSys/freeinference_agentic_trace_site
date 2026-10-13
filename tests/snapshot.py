"""The snapshot test: what a visitor sees on nine states of the site, kept as text in `tests/snapshots/` and compared.

A snapshot is one folder per page state, `tests/snapshots/<state>/`, holding one text file per unit the state shows:
each chart's SVG, each table's rows, each legend's entries, each card's texts, the stats strip, the facts card, the
request rows (see `snapshot_units.py` for what each file holds). The states are the Explore page with each of its six
Insights topics shown, and one session, the Session Explorer's first row, in each of its three views. A unit that is
the same in every state of a page is written once, with the page's first state: the Explore page's hero, stats strip,
Overview, Session Explorer, cite and team with its first topic; the Session page's heading and facts with its first
view.

    .venv/bin/python tests/snapshot.py           # compare: fails naming each unit that changed (make test)
    .venv/bin/python tests/snapshot.py --write   # rewrite every file (make snapshots)

Regenerate with `make snapshots` when a change is meant to alter a chart or a text, and review the diff of
`tests/snapshots/` like code: it is what a visitor will see differently. A data rebuild changes it too. Compare skips,
saying so, where Chromium is not installed (`make setup-browser`).

The site is served from `site/` by Python's own HTTP server on a free port and opened in headless Chromium, at a fixed
width, locale, time zone and colour scheme, so that every machine writes the same text.
"""

import argparse
import contextlib
import difflib
import functools
import http.server
import pathlib
import shutil
import sys
import threading

import playwright.sync_api

import snapshot_units

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE_FOLDER = ROOT / "site"
SNAPSHOTS_FOLDER = ROOT / "tests" / "snapshots"

# The Explore page's states, each a folder of `tests/snapshots/`, and the Insights topic each shows, by its section id;
# in the order of the topic tabs, the page opening on the first.
EXPLORE_STATES = {
    "explore-sessions": "insights-sessions",
    "explore-tokens": "insights-tokens",
    "explore-latency": "insights-latency",
    "explore-tools": "insights-tools",
    "explore-caching": "insights-caching",
    "explore-comparison": "insights-comparison",
}
# The Session page's states and the view each shows, by its tab's label; in the order of the tabs, the page opening on
# the first.
SESSION_STATES = {
    "session-requests": "Requests",
    "session-context": "Context",
    "session-timeline": "Timeline",
}
VIEWPORT = {"width": 1280, "height": 900}  # a desktop width: each chart is drawn at its card's width, which follows it
LOCALE = "en-US"  # the browser formats numbers and dates in its locale, so it is fixed
TIME_ZONE = "UTC"  # and in its time zone
DRAW_TIMEOUT_MS = 60_000  # the longest a state may take to draw: a topic fetches its answers, and Plot from the CDN
SETTLE_PAUSE_MS = 250  # the pause between two reads of a state; it is read until two reads agree
SETTLE_READS = 20  # the most reads of a state before it is called unsettled
DIFF_LINES_SHOWN = 12  # the lines of each changed unit's diff printed; `git diff` after `make snapshots` shows the rest
SKIP_MESSAGE = "snapshots skipped: Chromium could not start ({reason}). `make setup-browser` installs it."


class PageError(Exception):
    """The site logged an error in the browser's console, or a script threw, while the states were read."""


def state_names() -> list[str]:
    """The folder name of every state, in the order the states are read."""
    return list(EXPLORE_STATES) + list(SESSION_STATES)


class QuietRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Python's file server, without its line per request."""

    def log_message(self, format, *arguments):
        pass


@contextlib.contextmanager
def served_site(folder: pathlib.Path):
    """Serve `folder` on a free port of this machine while the block runs; yield its address."""
    handler = functools.partial(QuietRequestHandler, directory=str(folder))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)  # port 0: the system picks a free one
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()


def record_errors(page, errors: list[str]) -> None:
    """Append to `errors` every error `page` logs in its console or throws from now on."""
    page.on("console", functools.partial(record_console_error, errors))
    page.on("pageerror", functools.partial(record_thrown_error, errors))


def record_console_error(errors: list[str], message) -> None:
    """Append a console message to `errors` when it is an error."""
    if message.type == "error":
        errors.append(f"console: {message.text}")


def record_thrown_error(errors: list[str], error) -> None:
    """Append an error a script threw to `errors`."""
    errors.append(f"thrown: {error}")


def wait_until_drawn(page) -> None:
    """Wait until no loading line is visible: every chart, table and text block of the state has been drawn."""
    playwright.sync_api.expect(page.locator(".loading:visible")).to_have_count(0, timeout=DRAW_TIMEOUT_MS)


def read_when_settled(page, read) -> dict[str, str]:
    """Call `read()` until two calls a pause apart return the same units, so a chart still drawing is not read."""
    previous = read()
    for attempt in range(SETTLE_READS):
        page.wait_for_timeout(SETTLE_PAUSE_MS)
        current = read()
        if current == previous:
            return current
        previous = current
    raise PageError(f"the page was still changing after {SETTLE_READS} reads at {page.url}")


def read_explore_states(page, address: str) -> dict[str, dict[str, str]]:
    """The units of the Explore page with each topic shown in turn, by its tab, and its other parts with the first."""
    page.goto(f"{address}/index.html", wait_until="networkidle")
    states = {}
    for state, topic in EXPLORE_STATES.items():
        page.locator(f"#tab-{topic}").click()
        playwright.sync_api.expect(page.locator(f"#{topic}")).to_be_visible()
        wait_until_drawn(page)
        units = read_when_settled(page, functools.partial(snapshot_units.topic_units, page, topic))
        if not states:  # the first state also holds the page's units that no tab changes
            units.update(read_when_settled(page, functools.partial(snapshot_units.explore_page_units, page)))
        states[state] = units
    return states


def first_session_address(page, address: str) -> str:
    """The address of the Session page of the Session Explorer's first row, the newest session."""
    page.goto(f"{address}/index.html", wait_until="networkidle")
    wait_until_drawn(page)
    link = page.locator("#sessions-table tbody a").first.get_attribute("href")
    return f"{address}/{link}"


def read_session_states(page, address: str) -> dict[str, dict[str, str]]:
    """The units of the first row's session in each view in turn, by its tab, and the page's heading and facts with
    the first."""
    page.goto(first_session_address(page, address), wait_until="networkidle")
    states = {}
    for state, view in SESSION_STATES.items():
        page.locator("#views .view-tab", has_text=view).click()
        playwright.sync_api.expect(page.locator("#views .view-tab.is-active")).to_have_text(view)
        wait_until_drawn(page)
        units = read_when_settled(page, functools.partial(snapshot_units.session_view_units, page))
        if not states:  # the first state also holds the page's units that no tab changes
            units.update(read_when_settled(page, functools.partial(snapshot_units.session_page_units, page)))
        states[state] = units
    return states


def read_states(browser, address: str) -> dict[str, dict[str, str]]:
    """Every state's units, `{state: {unit: text}}`, read in a fresh page of `browser` from the site at `address`."""
    page = browser.new_page(viewport=VIEWPORT, locale=LOCALE, timezone_id=TIME_ZONE, color_scheme="light")
    errors = []
    record_errors(page, errors)
    states = read_explore_states(page, address)
    states.update(read_session_states(page, address))
    page.close()
    if errors:
        raise PageError("the site reported errors in the browser:\n" + "\n".join(errors))
    return states


def snapshot_files(states: dict[str, dict[str, str]]) -> dict[pathlib.Path, str]:
    """Each unit's file and the text it holds, ending in a newline."""
    files = {}
    for state, units in states.items():
        for unit, text in units.items():
            files[SNAPSHOTS_FOLDER / state / f"{unit}.txt"] = text + "\n"
    return files


def write_snapshots(files: dict[pathlib.Path, str]) -> None:
    """Replace `tests/snapshots/` with `files`, so a unit no longer shown leaves no file behind."""
    if SNAPSHOTS_FOLDER.exists():
        shutil.rmtree(SNAPSHOTS_FOLDER)
    for path, text in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


def diff_excerpt(kept: str, shown: str) -> list[str]:
    """The first lines of a diff from the kept text of a unit to the text the site shows now."""
    diff = list(difflib.unified_diff(kept.splitlines(), shown.splitlines(), lineterm="", n=0))
    without_file_names = diff[2:]  # a unified diff starts with two lines naming its two sides
    return without_file_names[:DIFF_LINES_SHOWN]


def changed_units(files: dict[pathlib.Path, str]) -> list[str]:
    """A report of every unit whose file differs from what the site shows now: changed, new, or no longer shown."""
    report = []
    for path, text in sorted(files.items()):
        name = path.relative_to(ROOT)
        if not path.exists():
            report.append(f"new: {name}")
            continue
        kept = path.read_text()
        if kept != text:
            report.append(f"changed: {name}\n    " + "\n    ".join(diff_excerpt(kept, text)))
    for path in sorted(SNAPSHOTS_FOLDER.rglob("*.txt")):
        if path not in files:
            report.append(f"no longer shown: {path.relative_to(ROOT)}")
    return report


def compare_snapshots(files: dict[pathlib.Path, str]) -> int:
    """Print every unit that changed and return 1, or say the snapshots are unchanged and return 0."""
    report = changed_units(files)
    for entry in report:
        print(entry)
    if report:
        print(f"{len(report)} units differ. If the change is meant, run `make snapshots` and review `git diff "
              f"{SNAPSHOTS_FOLDER.relative_to(ROOT)}`.")
        return 1
    print(f"snapshots unchanged: {len(files)} units in {len(state_names())} states")
    return 0


def parse_arguments(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare the site with its snapshots in tests/snapshots/.")
    parser.add_argument("--write", action="store_true", help="rewrite the snapshots instead of comparing")
    return parser.parse_args(arguments)


def main(arguments: list[str]) -> int:
    """Compare the site with its snapshots, or with `--write` rewrite them; the exit code is 1 when a unit changed or
    the site reported an error, 0 when Chromium cannot start and the comparison is skipped."""
    write = parse_arguments(arguments).write
    with served_site(SITE_FOLDER) as address, playwright.sync_api.sync_playwright() as browsers:
        try:
            browser = browsers.chromium.launch()
        except playwright.sync_api.Error as error:  # Chromium is not installed, or cannot start on this machine
            if write:
                raise
            print(SKIP_MESSAGE.format(reason=str(error).splitlines()[0]))
            return 0
        try:
            files = snapshot_files(read_states(browser, address))
        except PageError as error:
            print(f"snapshots failed: {error}")
            return 1
        # Leaving the block closes Chromium and stops the server.
    if write:
        write_snapshots(files)
        print(f"snapshots written: {len(files)} files in {SNAPSHOTS_FOLDER.relative_to(ROOT)}/")
        return 0
    return compare_snapshots(files)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
