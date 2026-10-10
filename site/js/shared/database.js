/**
 * The page's DuckDB database: the data files as the views `requests`, `tool_calls`, `sessions` and
 * `simulation`, the selection tables every query reads, and queries run by name.
 *
 * A query's name is its path under `site/queries/` without `.sql`: `runQuery("explore/request_count")`
 * runs `queries/explore/request_count.sql`, fetched relative to the page.
 */

import { scopesOf } from "./selection.js";

// The placeholder in a view statement that stands for the data folder's absolute URL.
const DATA_URL_TOKEN = "{data_url}";

// The statements that register each data file as a view; their text holds the data URL placeholder.
const VIEW_STATEMENTS = Object.freeze([
  "setup/view_requests",
  "setup/view_tool_calls",
  "setup/view_sessions",
  "setup/view_simulation",
]);

// The statements that make the empty selection tables, run once after the views.
const SELECTION_TABLE_STATEMENTS = Object.freeze([
  "setup/create_selected_weeks",
  "setup/create_selected_scopes",
  "setup/create_selected_session",
]);

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
  return statement.replaceAll(DATA_URL_TOKEN, folderUrl);
}

/** A copy of `row` with every bigint value converted to a number; every other value unchanged. */
export function plainRow(row) {
  const plain = {};
  for (const [column, value] of Object.entries(row)) {
    plain[column] = typeof value === "bigint" ? Number(value) : value;
  }
  return plain;
}

/**
 * One DuckDB connection with the selection tables, and the text of every statement it has fetched.
 * Each statement file is fetched once; its text is kept in `#statementTexts` by name.
 */
class Database {
  #connection;
  #statementTexts = new Map();

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

  /** The rows of the query `name`, as plain objects with bigint values converted to numbers. */
  async runQuery(name) {
    const result = await this.#connection.query(await this.#statementText(name));
    return result.toArray().map((row) => plainRow(row.toJSON()));
  }

  /** Empty `selected_weeks` and `selected_scopes`, then fill them with `weeks` and the scopes `scope` covers. */
  async setSelection({ weeks, scope }) {
    await this.#runStatement("setup/clear_selected_weeks");
    await this.#insertEach("setup/insert_selected_week", weeks);
    await this.#runStatement("setup/clear_selected_scopes");
    await this.#insertEach("setup/insert_selected_scope", scopesOf(scope));
  }

  /** Empty `selected_session`, then hold the one session `rootSessionId` of `week`. */
  async setSession({ week, rootSessionId }) {
    await this.#runStatement("setup/clear_selected_session");
    const insert = await this.#connection.prepare(await this.#statementText("setup/insert_selected_session"));
    await insert.query(week, rootSessionId);
    await insert.close();
  }

  /** Run the statement `name`, which takes no parameters; its result is not read. */
  async #runStatement(name) {
    await this.#connection.query(await this.#statementText(name));
  }

  /** Run the one-parameter statement `name` once for each of `values`. */
  async #insertEach(name, values) {
    const insert = await this.#connection.prepare(await this.#statementText(name));
    for (const value of values) {
      await insert.query(value);
    }
    await insert.close();
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
  return database.connect();
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
