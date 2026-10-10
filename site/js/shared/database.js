/**
 * The page's data: the weeks `weeks.json` lists, and the DuckDB database, with the data files as the views
 * `requests`, `tool_calls`, `sessions` and `simulation`, the selection tables every query reads, and queries run
 * by name.
 *
 * A query's name is its path under `site/queries/` without `.sql`: `runQuery("explore/request_count")`
 * runs `queries/explore/request_count.sql`, fetched relative to the page. `runQueryWith(name, parameters)`
 * runs a query that takes `?` parameters.
 */

import { scopesOf } from "./selection.js";

// The placeholder in a view statement that stands for the data folder's absolute URL.
const DATA_URL_TOKEN = "{data_url}";

// The statements that register each data file as a view; their text holds the data URL placeholder.
const VIEW_STATEMENTS = Object.freeze([
  "setup/create_view_requests",
  "setup/create_view_tool_calls",
  "setup/create_view_sessions",
  "setup/create_view_simulation",
]);

// The statements that make the empty selection tables, run once after the views.
const SELECTION_TABLE_STATEMENTS = Object.freeze([
  "setup/create_selected_weeks",
  "setup/create_selected_scopes",
  "setup/create_selected_session",
]);

// How query results arrive: 64-bit and 128-bit integers (a SUM of an integer column) and decimals as
// JavaScript numbers. Every count and token total of this site fits a double exactly.
const QUERY_CONFIG = Object.freeze({ castBigIntToDouble: true, castDecimalToDouble: true });

// The weeks the data hold, relative to a page; read before DuckDB is opened.
const WEEKS_FILE = "data/weeks.json";

/** The entries of `data/weeks.json`, oldest first. */
export async function fetchWeeks() {
  const response = await fetch(WEEKS_FILE);
  if (!response.ok) {
    throw new Error(`Could not fetch ${WEEKS_FILE}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * The database of one page, open over the data folder at `dataUrl` (an absolute URL) with empty selection tables.
 * A page opens it once.
 */
export function openDatabase(dataUrl) {
  return Database.open(dataUrl);
}

/** `statement` with the data URL placeholder replaced by `dataUrl`, without its trailing slash. */
export function withDataUrl(statement, dataUrl) {
  // The statements write `{data_url}/requests.parquet`, so the folder's own slash would be doubled.
  const folderUrl = dataUrl.endsWith("/") ? dataUrl.slice(0, -1) : dataUrl;
  // A function as the replacement, so a `$` in the URL is taken as it is and not as a replacement pattern.
  return statement.replaceAll(DATA_URL_TOKEN, () => folderUrl);
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

  /** A new database over the data folder at `dataUrl`, with the four views and the empty selection tables. */
  static async open(dataUrl) {
    const database = new Database(await connectToDuckDB());
    for (const name of VIEW_STATEMENTS) {
      const statement = await database.#statementText(name);
      await database.#connection.query(withDataUrl(statement, dataUrl));
    }
    for (const name of SELECTION_TABLE_STATEMENTS) {
      await database.#runStatement(name);
    }
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
   * Empty `selected_weeks` and `selected_scopes`, then fill them with `weeks` and the scopes `scope` covers.
   * A call starts only after every earlier selection or session change has finished, so two quick calls
   * never mix. A page still awaits it before running its queries, and drops the results of a run that a
   * newer selection has replaced.
   */
  setSelection({ weeks, scope }) {
    return this.#afterEarlierChanges(() => this.#fillSelection(weeks, scope));
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

  async #fillSelection(weeks, scope) {
    await this.#runStatement("setup/clear_selected_weeks");
    await this.#insertEach("setup/insert_selected_week", weeks);
    await this.#runStatement("setup/clear_selected_scopes");
    await this.#insertEach("setup/insert_selected_scope", scopesOf(scope));
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

/** A connection to a new DuckDB-WASM database running in a worker. */
async function connectToDuckDB() {
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
  return database.connect();
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
