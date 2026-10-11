"""The site's database for the tests: `site_data.site_database`, which sets the database up as the browser does,
under the names the tests use, and the list of every query a page runs.

A test opens the database over the fixture's data folder, fills the selection
tables and runs a query by name, exactly as a page runs it.
"""

import site_data.site_database

QUERIES_FOLDER = site_data.site_database.QUERIES_FOLDER  # every query file, under its page's folder
SETUP_FOLDER = site_data.site_database.SETUP_FOLDER  # the statements that create and fill the views and tables
VIEW_STATEMENTS_BY_KIND = site_data.site_database.VIEW_STATEMENTS  # each kind of row's view statement, in order
VIEW_STATEMENTS = list(VIEW_STATEMENTS_BY_KIND.values())  # in the order the views are made
SELECTION_TABLE_STATEMENTS = site_data.site_database.SELECTION_TABLE_STATEMENTS
BENCHMARK_TABLE_STATEMENT = site_data.site_database.BENCHMARK_TABLE_STATEMENT

open_site_database = site_data.site_database.open_site_database
statement_text = site_data.site_database.statement_text
select_weeks = site_data.site_database.select_weeks
select_session = site_data.site_database.select_session
run_query = site_data.site_database.run_query


def query_names() -> list[str]:
    """The name of every query a page runs: each `.sql` file under `site/queries/` outside `setup/`, sorted."""
    names = []
    for path in sorted(QUERIES_FOLDER.rglob("*.sql")):
        if SETUP_FOLDER not in path.parents:
            names.append(path.relative_to(QUERIES_FOLDER).with_suffix("").as_posix())
    return names
