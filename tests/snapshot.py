"""The snapshot test: what a visitor sees on twelve states of the site, kept as text in `tests/snapshots/` and compared.

A snapshot is one folder per page state, `tests/snapshots/<state>/`, holding one text file per unit the state shows:
each chart's SVG, each table's rows, each legend's entries, each card's texts, the stats strip, the facts card, the
request rows. `snapshot_units.py` names the states and says what each file holds. The states are the Explore page with
each of its six Insights topics shown, and two fixed sessions, one plain and one with subagents, each in its three
views. A unit that is the same in every state of a page is written once, with the page's first state: the Explore
page's hero, stats strip, Overview, Session Explorer, cite and team with its first topic; a session's heading and facts
with its first view.

    .venv/bin/python tests/snapshot.py           # compare: fails naming each unit that changed (make test)
    .venv/bin/python tests/snapshot.py --write   # rewrite every file (make snapshots)

Regenerate with `make snapshots` when a change is meant to alter a chart or a text, and review the diff of
`tests/snapshots/` like code: it is what a visitor will see differently. A data rebuild changes it too. Compare skips,
saying so, where Chromium is not installed (`make setup-browser`). Plot, from jsDelivr, and the fonts, from Google, are
part of what is compared, so the test needs the network: offline it fails, naming the requests that failed.

The site is served from `site/` by Python's own HTTP server on a free port and opened in headless Chromium, at a fixed
width, locale, time zone and colour scheme, so that every machine writes the same text.
"""

import argparse
import contextlib
import difflib
import functools
import gzip
import http.server
import json
import pathlib
import shutil
import sys
import threading

import playwright.sync_api

import snapshot_units

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE_FOLDER = ROOT / "site"
SNAPSHOTS_FOLDER = ROOT / "tests" / "snapshots"
BUCKETS_FOLDER = SITE_FOLDER / "data" / "session_buckets"  # one folder per week, with the index of its session ids

VIEWPORT = {"width": 1280, "height": 900}  # a desktop width: each chart is drawn at its card's width, which follows it
LOCALE = "en-US"  # the browser formats numbers and dates in its locale, so it is fixed
TIME_ZONE = "UTC"  # and in its time zone
COLOUR_SCHEME = "light"  # the scheme the pages are read in; colours are recorded as tokens, which both schemes share
DRAW_TIMEOUT_MS = 60_000  # the longest a state may take to draw: a topic fetches its answers, and Plot from the CDN
SETTLE_PAUSE_MS = 250  # the pause between two reads of a state; it is read until two reads agree
SETTLE_REREADS = 20  # the most reads of a state after its first before it is called unsettled
DIFF_LINES_SHOWN = 12  # the lines of each changed unit's diff printed; `git diff` after `make snapshots` shows the rest
SKIP_MESSAGE = "snapshots skipped: Chromium could not start ({reason}). `make setup-browser` installs it."


class PageError(Exception):
    """The site could not be read as the snapshots need: a session is missing, a state did not draw, or the browser
    reported an error (a console error, an error a script threw, a request that failed)."""


class QuietRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Python's file server, without its line per request."""

    def log_message(self, message_format, *arguments):
        """Write nothing: the test prints its own report."""


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
    """Append to `errors` every error `page` logs in its console, throws, or meets fetching a file, from now on."""
    page.on("console", functools.partial(record_console_error, errors))
    page.on("pageerror", functools.partial(record_thrown_error, errors))
    page.on("requestfailed", functools.partial(record_failed_request, errors))


def record_console_error(errors: list[str], message) -> None:
    """Append a console message to `errors`, with the address it came from, when it is an error."""
    if message.type == "error":
        errors.append(f"console: {message.text} ({message.location['url']})")


def record_thrown_error(errors: list[str], error) -> None:
    """Append an error a script threw to `errors`."""
    errors.append(f"thrown: {error}")


def record_failed_request(errors: list[str], request) -> None:
    """Append a request that got no answer to `errors`, with its address, which names its host."""
    errors.append(f"request failed: {request.url} ({request.failure})")


def check_sessions_are_shipped() -> None:
    """Fail unless every session of `snapshot_units.SESSIONS` is in its week's index of the shipped data."""
    for name, session in snapshot_units.SESSIONS.items():
        index = BUCKETS_FOLDER / session.week / "index.json.gz"
        if not index.exists() or session.id not in json.loads(gzip.decompress(index.read_bytes())):
            raise PageError(f"the session {session.id} of the week {session.week}, {name!r} in "
                            "snapshot_units.SESSIONS, is not in site/data; choose another session")


def wait_until_drawn(page) -> None:
    """Wait until no loading line is visible: every chart, table and text block of the state has been drawn."""
    playwright.sync_api.expect(page.locator(".loading:visible")).to_have_count(0, timeout=DRAW_TIMEOUT_MS)


def read_when_settled(page, read) -> dict[str, str]:
    """Call `read()` until two calls a pause apart return the same units, so a chart still drawing is not read."""
    previous = read()
    for reread in range(SETTLE_REREADS):
        page.wait_for_timeout(SETTLE_PAUSE_MS)
        current = read()
        if current == previous:
            return current
        previous = current
    raise PageError(f"the page was still changing after {SETTLE_REREADS + 1} reads at {page.url}")


def read_explore_states(page, address: str) -> dict[str, dict[str, str]]:
    """The units of the Explore page with each topic shown in turn, by its tab, and its other parts with the first."""
    page.goto(f"{address}/index.html", wait_until="networkidle")
    states = {}
    for state, topic in snapshot_units.EXPLORE_STATES.items():
        page.locator(f"#tab-{topic}").click()
        playwright.sync_api.expect(page.locator(f"#{topic}")).to_be_visible()
        wait_until_drawn(page)
        try:
            units = read_when_settled(page, functools.partial(snapshot_units.topic_units, page, topic))
            if not states:  # the first state also holds the page's units that no tab changes
                units.update(read_when_settled(page, functools.partial(snapshot_units.explore_page_units, page)))
        except snapshot_units.SharedTitleError as error:
            raise PageError(f"in the state {state}: {error}") from error
        states[state] = units
    return states


def read_session_states(page, address: str, name: str, session) -> dict[str, dict[str, str]]:
    """The units of `session` (a `SessionAddress`) in each view in turn, by its tab, and its heading and facts with
    the first; each state named after the session's `name` and the view."""
    page.goto(f"{address}/session.html?week={session.week}&id={session.id}", wait_until="networkidle")
    states = {}
    for view, label in snapshot_units.VIEWS.items():
        page.locator("#views .view-tab", has_text=label).click()
        playwright.sync_api.expect(page.locator("#views .view-tab.is-active")).to_have_text(label)
        wait_until_drawn(page)
        units = read_when_settled(page, functools.partial(snapshot_units.session_view_units, page))
        if not states:  # the first state also holds the page's units that no tab changes
            units.update(read_when_settled(page, functools.partial(snapshot_units.session_page_units, page)))
        states[snapshot_units.session_state(name, view)] = units
    return states


def read_states(browser, address: str) -> dict[str, dict[str, str]]:
    """Every state's units, `{state: {unit: text}}`, read in a fresh page of `browser` from the site at `address`."""
    check_sessions_are_shipped()
    page = browser.new_page(viewport=VIEWPORT, locale=LOCALE, timezone_id=TIME_ZONE, color_scheme=COLOUR_SCHEME)
    errors = []
    record_errors(page, errors)
    try:
        states = read_explore_states(page, address)
        for name, session in snapshot_units.SESSIONS.items():
            states.update(read_session_states(page, address, name, session))
    except (playwright.sync_api.Error, AssertionError) as error:  # a state that did not draw: say why, with what the browser reported
        raise PageError(f"{error}\nthe browser reported:\n" + "\n".join(errors)) from error
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


def changed_units(files: dict[pathlib.Path, str], folder: pathlib.Path) -> list[str]:
    """A report of every unit whose file in `folder` differs from what the site shows now (`files`): changed, new, or
    no longer shown; each named by its path inside `folder`."""
    report = []
    for path, text in sorted(files.items()):
        name = path.relative_to(folder)
        if not path.exists():
            report.append(f"new: {name}")
            continue
        kept = path.read_text()
        if kept != text:
            report.append(f"changed: {name}\n    " + "\n    ".join(diff_excerpt(kept, text)))
    for path in sorted(folder.rglob("*.txt")):
        if path not in files:
            report.append(f"no longer shown: {path.relative_to(folder)}")
    return report


def compare_snapshots(files: dict[pathlib.Path, str]) -> int:
    """Print every unit that changed and return 1, or say the snapshots are unchanged and return 0."""
    folder_name = SNAPSHOTS_FOLDER.relative_to(ROOT)
    report = changed_units(files, SNAPSHOTS_FOLDER)
    if not report:
        print(f"snapshots unchanged: {len(files)} units in {len(snapshot_units.state_names())} states")
        return 0
    print(f"units that differ from {folder_name}/:")
    for entry in report:
        print(entry)
    print(f"{len(report)} units differ. If the change is meant, run `make snapshots` and review `git diff {folder_name}`.")
    return 1


def parse_arguments(arguments: list[str]) -> argparse.Namespace:
    """The command line's options: `write`, true to rewrite the snapshots rather than compare."""
    parser = argparse.ArgumentParser(description="Compare the site with its snapshots in tests/snapshots/.")
    parser.add_argument("--write", action="store_true", help="rewrite the snapshots instead of comparing")
    return parser.parse_args(arguments)


def main(arguments: list[str]) -> int:
    """Compare the site with its snapshots, or with `--write` rewrite them; the exit code is 1 when a unit changed or
    the site could not be read, 0 when Chromium cannot start and the comparison is skipped."""
    write = parse_arguments(arguments).write
    with served_site(SITE_FOLDER) as address, playwright.sync_api.sync_playwright() as browsers:
        try:
            browser = browsers.chromium.launch()
        except (playwright.sync_api.Error, AssertionError) as error:  # Chromium is not installed, or cannot start on this machine
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
