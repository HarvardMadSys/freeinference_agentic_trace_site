"""The repository's rules, checked on every commit: short units, small folders, no aliased imports, one home for library
URLs and for SQL, libraries loaded only where they are drawn with, no machine paths, and the shipped data whole."""

import ast
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAX_FUNCTION_LINES = 50  # a longer function does two jobs
MAX_MODULE_LINES = 300  # a longer module holds two purposes
MAX_MODULES_PER_FOLDER = 9  # a folder holds one purpose and about eight modules
JAVASCRIPT_FOLDER = ROOT / "site" / "js"
LIBRARIES_MODULE = ROOT / "site" / "js" / "shared" / "libraries.js"  # the only file that names a library URL
QUERIES_FOLDER = ROOT / "site" / "queries"  # the only place SQL is written
SESSION_PAGE_MODULE = JAVASCRIPT_FOLDER / "pages" / "session.js"  # the Session page, which reads one bucket
DATABASE_MODULE = JAVASCRIPT_FOLDER / "shared" / "database.js"  # the Explore page's indexes and answers
PAGES = ("index.html", "session.html")  # the site's pages: Explore, the landing page, and Session
DATA_FOLDER = "site/data"  # built by `make data` and tracked, so a clone serves the site without building
ROW_KINDS = ("requests", "sessions", "tool_calls")  # the kinds of row every week has a file of; the simulation has fewer weeks
BUCKETS_FOLDER = "session_buckets"  # every week's folder of session buckets, beside its index `index.json.gz`
CDN_HOSTS = ("cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com", "esm.sh")

# A static import of the libraries module, by any relative path: the `from` clause, or an import for its side effects.
# A dynamic `await import("./libraries.js")` is the allowed way and does not match.
STATIC_LIBRARIES_IMPORT = re.compile(r"""(\bfrom\s+|^\s*import\s+)["'][^"']*libraries\.js["']""")

# A static import's module, a relative path in the `from` clause: `import { thing } from "./module.js";`.
RELATIVE_IMPORT = re.compile(r"""\bfrom\s+["'](\.{1,2}/[^"']+)["']""")

# An absolute path on a maintainer's machine: a home, project or scratch folder.
MACHINE_PATH = re.compile(r"/(home|madsys|scratch)/")

# A line of SQL: a statement keyword followed by the clause that names its table.
SQL_STATEMENT = re.compile(r"\b(SELECT|INSERT|CREATE|UPDATE|DELETE)\b.*\b(FROM|INTO|TABLE|VIEW)\b", re.IGNORECASE)

# Where a JavaScript function starts: a declaration, an arrow function given a name, or a method.
JS_FUNCTION_STARTS = (
    re.compile(r"^\s*(export\s+)?(async\s+)?function\b.*\{\s*$"),
    re.compile(r"^\s*(export\s+)?(const|let)\s+\w+\s*=\s*(async\s*)?\(.*\)\s*=>\s*\{\s*$"),
    re.compile(r"^\s*(async\s+)?(?!if\b|for\b|while\b|switch\b|catch\b)\w+\s*\(.*\)\s*\{\s*$"),
)


def python_files() -> list[pathlib.Path]:
    return sorted((ROOT / "site_data").rglob("*.py")) + sorted((ROOT / "tests").glob("*.py"))


def javascript_files() -> list[pathlib.Path]:
    return sorted((ROOT / "site" / "js").rglob("*.js")) + sorted((ROOT / "tests").glob("*.js"))


def line_count(path: pathlib.Path) -> int:
    return len(path.read_text().splitlines())


def javascript_function_lengths(lines: list[str]) -> list[tuple[int, int]]:
    """(first line, length) of each function: from its opening line to the closing brace at the same indent."""
    lengths = []
    for start, line in enumerate(lines):
        if not any(pattern.match(line) for pattern in JS_FUNCTION_STARTS):
            continue
        indent = line[: len(line) - len(line.lstrip())]
        closers = {indent + "}", indent + "};", indent + "})", indent + "});"}
        for end in range(start + 1, len(lines)):
            if lines[end].rstrip() in closers:
                lengths.append((start + 1, end - start + 1))
                break
    return lengths


def test_python_functions_are_short() -> None:
    for path in python_files():
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                length = node.end_lineno - node.lineno + 1
                assert length <= MAX_FUNCTION_LINES, f"{path.relative_to(ROOT)}:{node.lineno} {node.name} is {length} lines"


def test_javascript_functions_are_short() -> None:
    for path in javascript_files():
        for first_line, length in javascript_function_lengths(path.read_text().splitlines()):
            assert length <= MAX_FUNCTION_LINES, f"{path.relative_to(ROOT)}:{first_line} is a {length}-line function"


def test_modules_are_short() -> None:
    for path in python_files() + javascript_files():
        assert line_count(path) <= MAX_MODULE_LINES, f"{path.relative_to(ROOT)} is {line_count(path)} lines"


def test_python_imports_are_not_aliased() -> None:
    for path in python_files():
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    assert alias.asname is None, f"{path.relative_to(ROOT)}:{node.lineno} imports {alias.name} as {alias.asname}"


def test_library_urls_live_in_one_module() -> None:
    for path in javascript_files() + sorted((ROOT / "site").glob("*.html")):
        if path == LIBRARIES_MODULE:
            continue
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            assert not any(host in line for host in CDN_HOSTS), f"{path.relative_to(ROOT)}:{number} names a library URL"


def test_sql_lives_in_query_files() -> None:
    for path in javascript_files():
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            assert not SQL_STATEMENT.search(line), f"{path.relative_to(ROOT)}:{number} holds SQL; it belongs in {QUERIES_FOLDER.name}/"


def test_javascript_folders_are_small() -> None:
    for folder in sorted(path for path in JAVASCRIPT_FOLDER.rglob("*") if path.is_dir()):
        modules = sorted(folder.glob("*.js"))
        assert len(modules) <= MAX_MODULES_PER_FOLDER, f"{folder.relative_to(ROOT)} holds {len(modules)} modules"


def test_only_a_dynamic_import_loads_the_libraries() -> None:
    # node cannot load the CDN's modules, so a module that imported them statically could not be tested.
    for path in javascript_files():
        if path == LIBRARIES_MODULE:
            continue
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            assert not STATIC_LIBRARIES_IMPORT.search(line), f"{path.relative_to(ROOT)}:{number} imports {LIBRARIES_MODULE.name} statically"


def statically_imported_modules(page_module: pathlib.Path) -> set[pathlib.Path]:
    """The page module and every module it imports statically, directly or through another, as resolved paths."""
    found = set()
    to_read = [page_module.resolve()]
    while to_read:
        module = to_read.pop()
        if module in found:
            continue
        found.add(module)
        for name in RELATIVE_IMPORT.findall(module.read_text()):
            to_read.append((module.parent / name).resolve())
    return found


def test_the_session_page_does_not_load_the_database_module() -> None:
    for module in statically_imported_modules(SESSION_PAGE_MODULE):
        assert module != DATABASE_MODULE.resolve(), f"the Session page imports {DATABASE_MODULE.relative_to(ROOT)}"


def test_the_explore_page_s_start_imports_the_database() -> None:
    # The check above is only as good as the import pattern: the Explore page's start does import the database module.
    assert DATABASE_MODULE.resolve() in statically_imported_modules(JAVASCRIPT_FOLDER / "explore" / "start.js")


def test_the_site_has_two_pages_each_with_its_module() -> None:
    assert tuple(sorted(path.name for path in (ROOT / "site").glob("*.html"))) == PAGES
    page_modules = sorted(path.name for path in (JAVASCRIPT_FOLDER / "pages").glob("*.js"))
    assert page_modules == ["explore.js", "session.js"]


def tracked_text_files() -> list[pathlib.Path]:
    """Every file git tracks that reads as UTF-8 text."""
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True)
    text_files = []
    for name in tracked.stdout.splitlines():
        path = ROOT / name
        if not path.is_file():  # a tracked file deleted but not yet staged, or a symbolic link to a folder
            continue
        try:
            path.read_text()
        except UnicodeDecodeError:
            continue
        text_files.append(path)
    return text_files


def test_no_tracked_file_names_a_machine_path() -> None:
    for path in tracked_text_files():
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            assert not MACHINE_PATH.search(line), f"{path.relative_to(ROOT)}:{number} names a machine path"


def test_shipped_data_is_whole() -> None:
    """Git tracks the indexes, the query hashes, every week's row files and every week's session buckets with their
    index, so a clone serves every week and opens every session."""
    tracked = subprocess.run(["git", "ls-files", DATA_FOLDER], cwd=ROOT, capture_output=True, text=True, check=True)
    tracked_files = set(tracked.stdout.split())
    for name in ("weeks.json", "harnesses.json", "all_weeks/queries.json"):
        assert f"{DATA_FOLDER}/{name}" in tracked_files, f"{name} is not tracked"
    weeks = json.loads((ROOT / DATA_FOLDER / "weeks.json").read_text())
    assert weeks, "no weeks in the shipped data"
    for entry in weeks:
        for kind in ROW_KINDS:
            path = f"{DATA_FOLDER}/{kind}/week={entry['week']}/rows.parquet"
            assert path in tracked_files, f"{path} is not tracked"
        index = f"{DATA_FOLDER}/{BUCKETS_FOLDER}/{entry['week']}/index.json.gz"
        assert index in tracked_files, f"{index} is not tracked"
        buckets = [name for name in tracked_files if name.startswith(f"{DATA_FOLDER}/{BUCKETS_FOLDER}/{entry['week']}/")]
        assert len(buckets) > 1, f"{DATA_FOLDER}/{BUCKETS_FOLDER}/{entry['week']}/ holds no tracked bucket"
