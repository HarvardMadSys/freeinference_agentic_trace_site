/**
 * The page's data: the weeks `weeks.json` lists, the harnesses `harnesses.json` lists, and queries run by name. A
 * query's name is its path under `site/queries/` without `.sql`: `runQuery("explore/request_count")` runs
 * `queries/explore/request_count.sql`; `runQueryWith(name, parameters)` runs one that takes `?` parameters.
 *
 * A query `answerFileFor` names a file for is answered from it, which the data step wrote by running the query. Every
 * other query runs in DuckDB, loaded the first time a query needs it, with the weeks' files as the views `requests`,
 * `tool_calls`, `sessions` and `simulation`, the selection tables every query reads and the benchmark harness table.
 * A data file is `<kind>/week=<sunday>/rows.parquet` under the data folder, registered with DuckDB under that name as
 * a URL it reads in HTTP ranges; a view statement's `{files}` placeholder is replaced with its kind's files' names.
 * Only a simulated week has a simulation file; a kind no week has a file of gets no view (DuckDB cannot read no file).
 */

import { isDefaultSelection } from "./selection.js";

// The placeholder in a view statement that stands for its files' names, each single-quoted, separated by commas.
const FILES_PLACEHOLDER = "{files}";

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

// The statement that makes the table of benchmark harnesses, run after the selection tables and filled once.
const BENCHMARK_TABLE_STATEMENT = "setup/create_benchmark_harness";

// The one kind of row whose files only the simulated weeks have.
const SIMULATION_KIND = "simulation";

// Query results give 64- and 128-bit integers (a SUM) and decimals as numbers; every count and total fits a double.
const QUERY_CONFIG = Object.freeze({ castBigIntToDouble: true, castDecimalToDouble: true });

// The indexes of weeks and harnesses, relative to a page; read before any query.
const WEEKS_FILE = "data/weeks.json";
const HARNESSES_FILE = "data/harnesses.json";

// The folder of precomputed answers, relative to a page: the query `name`'s answer is `<folder><name>.json`.
const ANSWERS_FOLDER = "data/all_weeks/";

// The folders of the queries that have an answer for the default selection.
const ANSWERED_PAGES = Object.freeze(["explore/", "figures/"]);

// The colour orders: they read every week and harness whatever the selection, so their answers hold for any selection.
const COLOUR_ORDER_QUERIES = Object.freeze(["setup/category_order", "setup/harness_order", "setup/model_order"]);

/** The entries of `data/weeks.json`, oldest first: `{ week, last_day, month, simulated }`. */
export async function fetchWeeks() {
  return (await fetchFile(WEEKS_FILE)).json();
}

/** The entries of `data/harnesses.json`, most sessions first: `{ harness, sessions, benchmark }`. */
export async function fetchHarnesses() {
  return (await fetchFile(HARNESSES_FILE)).json();
}

/**
 * The database of one page, over the data folder at `dataUrl` (an absolute URL) with the files of `weeks` (the entries
 * of `weeks.json`) and the benchmark harnesses of `harnesses` (the entries of `harnesses.json`), and no selection yet.
 * DuckDB is not loaded until a query needs it. A page opens it once.
 */
export function openDatabase(dataUrl, weeks, harnesses) {
  return new Database(dataUrl, weeks, harnesses);
}

/**
 * The answer file of the query `name`, relative to the page: a colour order's always, an Explore or figure query's
 * while the selection is the default (`isDefault`); null for every other query, which DuckDB runs.
 */
export function answerFileFor(name, isDefault) {
  const isAnsweredPage = ANSWERED_PAGES.some((page) => name.startsWith(page));
  const isAnswered = COLOUR_ORDER_QUERIES.includes(name) || (isDefault && isAnsweredPage);
  return isAnswered ? `${ANSWERS_FOLDER}${name}.json` : null;
}

/** The names of the files of the kind of row `kind`, one per week of `weeks` that has one, in their order. */
export function weekFileNames(kind, weeks) {
  const names = [];
  for (const entry of weeks) {
    if (kind !== SIMULATION_KIND || entry.simulated) {
      names.push(`${kind}/week=${entry.week}/rows.parquet`);
    }
  }
  return names;
}

/** The absolute URL of the data file `name` in the data folder at `dataUrl`, with or without its trailing slash. */
export function fileUrl(dataUrl, name) {
  // Without the slash, the URL resolution would put the file beside the data folder instead of in it.
  const folderUrl = dataUrl.endsWith("/") ? dataUrl : `${dataUrl}/`;
  return new URL(name, folderUrl).href;
}

/** `statement` with the files placeholder replaced by `fileNames`, each single-quoted (a quote doubled), comma-separated. */
export function withFileNames(statement, fileNames) {
  const quoted = fileNames.map((name) => `'${name.replaceAll("'", "''")}'`);
  // A function as the replacement, so a `$` in a name is taken as it is and not as a replacement pattern.
  return statement.replaceAll(FILES_PLACEHOLDER, () => quoted.join(", "));
}

/** A copy of `row` with every bigint value converted to a number; every other value unchanged. */
export function plainRow(row) {
  const plain = {};
  for (const [column, value] of Object.entries(row)) {
    // QUERY_CONFIG normally makes DuckDB return numbers already; this catches any bigint it does not.
    plain[column] = typeof value === "bigint" ? Number(value) : value;
  }
  return plain;
}

/**
 * The queries of one page. The selection tables are filled before a DuckDB query whenever the selection has changed
 * since they were last filled. Each statement file is fetched once and its text kept by name. `#turn` settles when the
 * last change of the tables has finished; the next waits for it, so two quick changes never mix.
 */
class Database {
  #dataUrl;
  #weeks;
  #harnesses;
  #selection = null; // the selection last set, `{ weeks, harnesses }`; null before the first
  #filledSelection = null; // the selection the selection tables hold; null while they hold none
  #opening = null; // the promised DuckDB connection, from the first time a query needed it
  #statementTexts = new Map();
  #turn = Promise.resolve();

  constructor(dataUrl, weeks, harnesses) {
    this.#dataUrl = dataUrl;
    this.#weeks = weeks;
    this.#harnesses = harnesses;
  }

  /** The rows of the query `name`, as plain objects whose integers and decimals are numbers. */
  async runQuery(name) {
    const answerFile = answerFileFor(name, this.#isDefault());
    if (answerFile !== null) {
      const answer = await (await fetchFile(answerFile)).json();
      return answer.map(plainRow);
    }
    const connection = await this.#afterEarlierChanges(() => this.#connectionWithSelection());
    return plainRows(await connection.query(await this.#statementText(name)));
  }

  /** The rows of the query `name` run in DuckDB with `parameters` in place of its `?` placeholders, in order. */
  async runQueryWith(name, parameters) {
    const connection = await this.#connection();
    const statement = await connection.prepare(await this.#statementText(name));
    try {
      return plainRows(await statement.query(...parameters));
    } finally {
      await statement.close();
    }
  }

  /**
   * Make `weeks` (Sundays) and `harnesses` (names) the selection: the default leaves DuckDB alone, any other fills
   * `selected_weeks` and `selected_harnesses` once every earlier change of the tables has finished. A page awaits it
   * before running its queries, and drops the results of a run that a newer selection has replaced.
   */
  setSelection({ weeks, harnesses }) {
    this.#selection = { weeks, harnesses };
    return this.#afterEarlierChanges(() => (this.#isDefault() ? undefined : this.#connectionWithSelection()));
  }

  /** Empty `selected_session`, then hold the one session `rootSessionId` of `week`; ordered as `setSelection`. */
  setSession({ week, rootSessionId }) {
    return this.#afterEarlierChanges(() => this.#fillSession(week, rootSessionId));
  }

  #isDefault() {
    return this.#selection !== null && isDefaultSelection(this.#selection, this.#weeks, this.#harnesses);
  }

  /** Run `change` once the previous change has settled; its result or error is returned. */
  #afterEarlierChanges(change) {
    const turn = this.#turn.then(change);
    // The caller gets `turn` and sees its error; the next change only needs to know it has settled.
    this.#turn = turn.catch(() => undefined);
    return turn;
  }

  /** The DuckDB connection, its selection tables holding the latest selection when one has been set. */
  async #connectionWithSelection() {
    const connection = await this.#connection();
    const selection = this.#selection;
    if (selection !== null && selection !== this.#filledSelection) {
      await this.#runStatement(connection, "setup/clear_selected_weeks");
      await this.#runEach(connection, "setup/insert_selected_week", selection.weeks.map((week) => [week]));
      await this.#runStatement(connection, "setup/clear_selected_harnesses");
      await this.#runEach(connection, "setup/insert_selected_harness", selection.harnesses.map((harness) => [harness]));
      this.#filledSelection = selection;
    }
    return connection;
  }

  async #fillSession(week, rootSessionId) {
    const connection = await this.#connection();
    await this.#runStatement(connection, "setup/clear_selected_session");
    await this.#runEach(connection, "setup/insert_selected_session", [[week, rootSessionId]]);
  }

  /** The DuckDB connection, opened the first time it is asked for. */
  #connection() {
    this.#opening ??= this.#open();
    return this.#opening;
  }

  /** A new DuckDB connection: the views of the weeks' files, empty selection tables, the benchmark harness table. */
  async #open() {
    const { duckdb, engine } = await startDuckDB();
    const connection = await engine.connect();
    for (const [kind, name] of Object.entries(VIEW_STATEMENTS)) {
      const fileNames = weekFileNames(kind, this.#weeks);
      if (fileNames.length > 0) {
        await registerFiles(engine, this.#dataUrl, fileNames, duckdb.DuckDBDataProtocol.HTTP);
        await connection.query(withFileNames(await this.#statementText(name), fileNames));
      }
    }
    for (const name of SELECTION_TABLE_STATEMENTS) {
      await this.#runStatement(connection, name);
    }
    await this.#runStatement(connection, BENCHMARK_TABLE_STATEMENT);
    const benchmarkEntries = this.#harnesses.filter((entry) => entry.benchmark);
    await this.#runEach(connection, "setup/insert_benchmark_harness", benchmarkEntries.map((entry) => [entry.harness]));
    return connection;
  }

  /** Run the statement `name`, which takes no parameters, on `connection`; its result is not read. */
  async #runStatement(connection, name) {
    await connection.query(await this.#statementText(name));
  }

  /** Run the statement `name` on `connection` once for each of `parameterLists`, a list of its `?` parameters each. */
  async #runEach(connection, name, parameterLists) {
    const statement = await connection.prepare(await this.#statementText(name));
    try {
      for (const parameters of parameterLists) {
        await statement.query(...parameters);
      }
    } finally {
      await statement.close();
    }
  }

  /** The text of the statement `name`, fetched from `queries/<name>.sql` the first time it is asked for. */
  async #statementText(name) {
    if (!this.#statementTexts.has(name)) {
      const response = await fetchFile(`queries/${name}.sql`);
      this.#statementTexts.set(name, await response.text());
    }
    return this.#statementTexts.get(name);
  }
}

/** The DuckDB-WASM module and a database of it in a worker, open and ready to connect to: `{ duckdb, engine }`. */
async function startDuckDB() {
  // Loaded here, not imported at the top, so node can load this module's pure functions for the tests.
  const { loadDuckDB } = await import("./libraries.js");
  const duckdb = await loadDuckDB();
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  // A worker script must come from the page's own origin, so a one-line blob imports the CDN's worker.
  const workerScript = new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" });
  const workerUrl = URL.createObjectURL(workerScript);
  const worker = new Worker(workerUrl);
  // The VoidLogger keeps DuckDB's per-query log lines out of the console.
  const engine = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await engine.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  await engine.open({ query: QUERY_CONFIG });
  return { duckdb, engine };
}

/** Register each of `fileNames` with `engine` under its own name, as the URL of that file in the data folder. */
async function registerFiles(engine, dataUrl, fileNames, httpProtocol) {
  for (const name of fileNames) {
    // HTTP, so DuckDB reads the file in ranges as it reads a URL named in a query; direct I/O off, the library's default.
    await engine.registerFileURL(name, fileUrl(dataUrl, name), httpProtocol, false);
  }
}

/** The rows of a DuckDB result as plain objects whose integers and decimals are numbers. */
function plainRows(result) {
  return result.toArray().map((row) => plainRow(row.toJSON()));
}

/** The response to fetching `file` relative to the page; throws naming the file if it cannot be fetched. */
async function fetchFile(file) {
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Could not fetch ${file}: ${response.status} ${response.statusText}`);
  }
  return response;
}
