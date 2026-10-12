/**
 * The DuckDB database a page queries: the weeks' files as the views `requests`, `tool_calls`, `sessions` and
 * `simulation`, the empty selection tables every query reads, the views over the selected rows, and the filled
 * benchmark harness table.
 *
 * A statement is named by its path under `site/queries/` without `.sql`; `statementText(name)`, given by the caller,
 * returns its text. A view statement's `{files}` placeholder is replaced with its kind's files' names. Only a simulated
 * week has a simulation file; a kind no week has a file of gets no view (DuckDB cannot read no file).
 */

import { registerFiles, weekFileNames, withFileNames } from "./duckdb_files.js";
import { startDuckDB } from "./duckdb_start.js";

// The statement making each kind of row's view, holding the files placeholder, by the kind (also its folder), in order.
const VIEW_STATEMENTS = Object.freeze({
  requests: "setup/create_view_requests",
  tool_calls: "setup/create_view_tool_calls",
  sessions: "setup/create_view_sessions",
  simulation: "setup/create_view_simulation",
});

// The statements that make the empty selection tables, run once after the views.
const SELECTION_TABLE_STATEMENTS = Object.freeze([
  "setup/create_selected_weeks", "setup/create_selected_harnesses", "setup/create_selected_session",
]);

// The statements that make the views over the selected rows, run after the selection tables they read.
const SELECTION_VIEW_STATEMENTS = Object.freeze(["setup/create_view_session_time"]);

// The statement that makes the table of benchmark harnesses, run after the selection views and filled once.
const BENCHMARK_TABLE_STATEMENT = "setup/create_benchmark_harness";

/** The kinds of row, each a view and a folder of the data, in the order their views are made. */
export const ROW_KINDS = Object.freeze(Object.keys(VIEW_STATEMENTS));

/**
 * A new DuckDB database and a connection to it, `{ engine, connection, httpProtocol }` (the last being how a file
 * registered as a URL is read): the views of the files of `weeks` (the
 * entries of `weeks.json`) in the data folder at `dataUrl`, read over HTTP ranges, the empty selection tables, the
 * views over them, and the benchmark harnesses of `harnesses` (the entries of `harnesses.json`).
 */
export async function openDuckDB(dataUrl, weeks, harnesses, statementText) {
  const { duckdb, engine } = await startDuckDB();
  const connection = await engine.connect();
  for (const [kind, name] of Object.entries(VIEW_STATEMENTS)) {
    const fileNames = weekFileNames(kind, weeks);
    if (fileNames.length > 0) {
      await registerFiles(engine, dataUrl, fileNames, duckdb.DuckDBDataProtocol.HTTP);
      await connection.query(withFileNames(await statementText(name), fileNames));
    }
  }
  for (const name of [...SELECTION_TABLE_STATEMENTS, ...SELECTION_VIEW_STATEMENTS]) {
    await runStatement(connection, await statementText(name));
  }
  await runStatement(connection, await statementText(BENCHMARK_TABLE_STATEMENT));
  const benchmarkEntries = harnesses.filter((entry) => entry.benchmark);
  const insertBenchmark = await statementText("setup/insert_benchmark_harness");
  await runEach(connection, insertBenchmark, benchmarkEntries.map((entry) => [entry.harness]));
  return { engine, connection, httpProtocol: duckdb.DuckDBDataProtocol.HTTP };
}

/** Run the statement `text`, which takes no parameters, on `connection`; its result is not read. */
export async function runStatement(connection, text) {
  await connection.query(text);
}

/** Run the statement `text` on `connection` once for each of `parameterLists`, a list of its `?` parameters each. */
export async function runEach(connection, text, parameterLists) {
  const statement = await connection.prepare(text);
  try {
    for (const parameters of parameterLists) {
      await statement.query(...parameters);
    }
  } finally {
    await statement.close();
  }
}
