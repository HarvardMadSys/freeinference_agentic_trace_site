/**
 * The page's data: the weeks `weeks.json` lists, the harnesses `harnesses.json` lists, and the DuckDB database, with
 * the weeks' data files as the views `requests`, `tool_calls`, `sessions` and `simulation`, the selection tables every
 * query reads, the table of benchmark harnesses, and queries run by name.
 *
 * A data file is `<kind>/week=<sunday>/rows.parquet` under the data folder, as `site_data/paths.py` writes it. Each is
 * registered with DuckDB under that name, as a URL DuckDB reads in HTTP ranges, and a view statement's `{files}`
 * placeholder is replaced with the names of its kind's files. Every week has a file of requests, tool calls and
 * sessions; only a simulated week has a simulation file; a kind no week has a file of gets no view, since DuckDB cannot
 * read an empty list of files.
 *
 * A query's name is its path under `site/queries/` without `.sql`: `runQuery("explore/request_count")`
 * runs `queries/explore/request_count.sql`, fetched relative to the page. `runQueryWith(name, parameters)`
 * runs a query that takes `?` parameters.
 */

// The placeholder in a view statement that stands for its files' names, each single-quoted, separated by commas.
const FILES_PLACEHOLDER = "{files}";

// A view statement's name is this prefix and the kind of row its view reads, which is also the kind's folder.
const VIEW_STATEMENT_PREFIX = "setup/create_view_";

// The statements that register each kind of row as a view, in the order they run; each holds the files placeholder.
const VIEW_STATEMENTS = Object.freeze([
  "setup/create_view_requests",
  "setup/create_view_tool_calls",
  "setup/create_view_sessions",
  "setup/create_view_simulation",
]);

// The statements that make the empty selection tables, run once after the views.
const SELECTION_TABLE_STATEMENTS = Object.freeze([
  "setup/create_selected_weeks",
  "setup/create_selected_harnesses",
  "setup/create_selected_session",
]);

// The statement that makes the table of benchmark harnesses, run after the selection tables and filled once.
const BENCHMARK_TABLE_STATEMENT = "setup/create_benchmark_harness";

// The one kind of row whose files only the simulated weeks have.
const SIMULATION_KIND = "simulation";

// How query results arrive: 64-bit and 128-bit integers (a SUM of an integer column) and decimals as
// JavaScript numbers. Every count and token total of this site fits a double exactly.
const QUERY_CONFIG = Object.freeze({ castBigIntToDouble: true, castDecimalToDouble: true });

// The indexes of weeks and harnesses, relative to a page; read before DuckDB is opened.
const WEEKS_FILE = "data/weeks.json";
const HARNESSES_FILE = "data/harnesses.json";

/** The entries of `data/weeks.json`, oldest first: `{ week, last_day, month, simulated }`. */
export function fetchWeeks() {
  return fetchIndex(WEEKS_FILE);
}

/** The entries of `data/harnesses.json`, most sessions first: `{ harness, sessions, benchmark }`. */
export function fetchHarnesses() {
  return fetchIndex(HARNESSES_FILE);
}

/**
 * The database of one page, open over the data folder at `dataUrl` (an absolute URL) with the files of `weeks`
 * (the entries of `weeks.json`), empty selection tables, and the benchmark harnesses of `harnesses` (the entries of
 * `harnesses.json`). A page opens it once.
 */
export function openDatabase(dataUrl, weeks, harnesses) {
  return Database.open(dataUrl, weeks, harnesses);
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
 * One DuckDB connection with the selection tables, and the text of every statement it has fetched.
 * Each statement file is fetched once; its text is kept in `#statementTexts` by name.
 * `#selectionTurn` settles when the last selection or session change has finished; the next one waits for it.
 */
class Database {
  #connection;
  #statementTexts = new Map();
  #selectionTurn = Promise.resolve();

  constructor(connection) {
    this.#connection = connection;
  }

  /**
   * A new database over the data folder at `dataUrl`: the views of the files of `weeks`, the empty selection tables,
   * and the benchmark harness table holding the harnesses of `harnesses` marked as the benchmark.
   */
  static async open(dataUrl, weeks, harnesses) {
    const duckDB = await startDuckDB();
    const database = new Database(await duckDB.connect());
    for (const name of VIEW_STATEMENTS) {
      const kind = name.slice(VIEW_STATEMENT_PREFIX.length);
      const fileNames = weekFileNames(kind, weeks);
      if (fileNames.length > 0) {
        await registerFiles(duckDB, dataUrl, fileNames);
        await database.#connection.query(withFileNames(await database.#statementText(name), fileNames));
      }
    }
    for (const name of SELECTION_TABLE_STATEMENTS) {
      await database.#runStatement(name);
    }
    await database.#runStatement(BENCHMARK_TABLE_STATEMENT);
    const benchmarkHarnesses = harnesses.filter((entry) => entry.benchmark).map((entry) => entry.harness);
    await database.#insertEach("setup/insert_benchmark_harness", benchmarkHarnesses);
    return database;
  }

  /** The rows of the query `name`, as plain objects whose integers and decimals are numbers. */
  async runQuery(name) {
    const result = await this.#connection.query(await this.#statementText(name));
    return plainRows(result);
  }

  /** The rows of the query `name` run with `parameters` in place of its `?` placeholders, in order; as `runQuery`. */
  async runQueryWith(name, parameters) {
    const statement = await this.#connection.prepare(await this.#statementText(name));
    try {
      return plainRows(await statement.query(...parameters));
    } finally {
      await statement.close();
    }
  }

  /**
   * Empty `selected_weeks` and `selected_harnesses`, then fill them with `weeks` (Sundays) and `harnesses` (names).
   * A call starts only after every earlier selection or session change has finished, so two quick calls
   * never mix. A page still awaits it before running its queries, and drops the results of a run that a
   * newer selection has replaced.
   */
  setSelection({ weeks, harnesses }) {
    return this.#afterEarlierChanges(() => this.#fillSelection(weeks, harnesses));
  }

  /** Empty `selected_session`, then hold the one session `rootSessionId` of `week`; ordered as `setSelection`. */
  setSession({ week, rootSessionId }) {
    return this.#afterEarlierChanges(() => this.#fillSession(week, rootSessionId));
  }

  /** Run `change` once the previous selection or session change has settled; its result or error is returned. */
  #afterEarlierChanges(change) {
    const turn = this.#selectionTurn.then(change);
    // The caller gets `turn` and sees its error; the next change only needs to know it has settled.
    this.#selectionTurn = turn.catch(() => undefined);
    return turn;
  }

  async #fillSelection(weeks, harnesses) {
    await this.#runStatement("setup/clear_selected_weeks");
    await this.#insertEach("setup/insert_selected_week", weeks);
    await this.#runStatement("setup/clear_selected_harnesses");
    await this.#insertEach("setup/insert_selected_harness", harnesses);
  }

  async #fillSession(week, rootSessionId) {
    await this.#runStatement("setup/clear_selected_session");
    const insert = await this.#connection.prepare(await this.#statementText("setup/insert_selected_session"));
    try {
      await insert.query(week, rootSessionId);
    } finally {
      await insert.close();
    }
  }

  /** Run the statement `name`, which takes no parameters; its result is not read. */
  async #runStatement(name) {
    await this.#connection.query(await this.#statementText(name));
  }

  /** Run the one-parameter statement `name` once for each of `values`. */
  async #insertEach(name, values) {
    const insert = await this.#connection.prepare(await this.#statementText(name));
    try {
      for (const value of values) {
        await insert.query(value);
      }
    } finally {
      await insert.close();
    }
  }

  /** The text of the statement `name`, fetched from `queries/<name>.sql` the first time it is asked for. */
  async #statementText(name) {
    if (!this.#statementTexts.has(name)) {
      this.#statementTexts.set(name, await fetchStatement(name));
    }
    return this.#statementTexts.get(name);
  }
}

/** A new DuckDB-WASM database running in a worker, open and ready to connect to. */
async function startDuckDB() {
  // Loaded here, not imported at the top, so node can load this module's pure functions for the tests.
  const { duckdb } = await import("./libraries.js");
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  // A worker script must come from the page's own origin, so a one-line blob imports the CDN's worker.
  const workerScript = new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" });
  const workerUrl = URL.createObjectURL(workerScript);
  const worker = new Worker(workerUrl);
  // The VoidLogger keeps DuckDB's per-query log lines out of the console.
  const database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  await database.open({ query: QUERY_CONFIG });
  return database;
}

/** Register each of `fileNames` with `duckDB` under its own name, as the URL of that file in the data folder. */
async function registerFiles(duckDB, dataUrl, fileNames) {
  // Loaded here, not imported at the top, as in `startDuckDB`.
  const { duckdb } = await import("./libraries.js");
  for (const name of fileNames) {
    // HTTP, so DuckDB reads the file in ranges as it reads a URL named in a query; direct I/O off, the library's default.
    await duckDB.registerFileURL(name, fileUrl(dataUrl, name), duckdb.DuckDBDataProtocol.HTTP, false);
  }
}

/** The rows of a DuckDB result as plain objects whose integers and decimals are numbers. */
function plainRows(result) {
  return result.toArray().map((row) => plainRow(row.toJSON()));
}

/** The text of `queries/<name>.sql`, fetched relative to the page; throws naming the file if it cannot be fetched. */
async function fetchStatement(name) {
  const file = `queries/${name}.sql`;
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Could not fetch the query file ${file}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/** The JSON of the index file `file`, fetched relative to the page; throws naming the file if it cannot be fetched. */
async function fetchIndex(file) {
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Could not fetch ${file}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
