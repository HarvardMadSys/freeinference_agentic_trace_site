/**
 * The page's data: the weeks `weeks.json` lists, the harnesses `harnesses.json` lists, and queries run by name. A
 * query's name is its path under `site/queries/` without `.sql`: `runQuery("explore/request_count")` runs
 * `queries/explore/request_count.sql`; `runQueryWith(name, parameters)` runs one that takes `?` parameters.
 *
 * A query `answerFileFor` names a file for is answered from it, which the data step wrote by running the query. Every
 * other query runs in DuckDB, loaded the first time a query needs it, as `engine/duckdb_views.js` sets it up. After a
 * page has drawn its first view it may stream the weeks' files into memory (`streamRows`), so that a later query reads
 * memory instead of HTTP ranges, as `engine/duckdb_files.js` does it.
 */

import { streamingOrder, streamWeekFiles, swapFileToMemory } from "../engine/duckdb_files.js";
import { openDuckDB, ROW_KINDS, runEach, runStatement } from "../engine/duckdb_views.js";
import { isDefaultSelection } from "./selection.js";

// After the default view is drawn, fetch every week's rows into memory so a narrowed selection runs without range
// reads; false leaves every narrowed selection on HTTP ranges.
export const STREAM_ROWS_AFTER_DRAW = true;

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

/** A copy of `row` with every bigint value converted to a number; every other value unchanged. */
export function plainRow(row) {
  const plain = {};
  for (const [column, value] of Object.entries(row)) {
    // The engine's query settings normally make DuckDB return numbers already; this catches any bigint they do not.
    plain[column] = typeof value === "bigint" ? Number(value) : value;
  }
  return plain;
}

/**
 * The queries of one page. The selection tables are filled before a DuckDB query whenever the selection has changed
 * since they were last filled. Each statement file is fetched once and its text kept by name. `#turn` settles when the
 * last change of DuckDB (a fill of the tables, or a streamed file swapped in) has finished; the next waits for it, so
 * two quick changes never mix. A DuckDB query starts in a turn, so none starts during a swap, and a swap waits for the
 * queries already running to finish.
 */
class Database {
  #dataUrl;
  #weeks;
  #harnesses;
  #selection = null; // the selection last set, `{ weeks, harnesses }`; null before the first
  #filledSelection = null; // the selection the selection tables hold; null while they hold none
  #opening = null; // the promised DuckDB, `{ engine, connection, httpProtocol }`, from the first query that needed it
  #statementTexts = new Map();
  #runningQueries = new Set(); // the promised results of the DuckDB queries started and not yet settled
  // Queries are not serialised by it, only started in it: they run side by side, as DuckDB's worker queues them anyway.
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
    const text = await this.#statementText(name);
    const started = await this.#afterEarlierChanges(() => this.#startQuery(text));
    return plainRows(await started.result);
  }

  /** The rows of the query `name` run in DuckDB with `parameters` in place of its `?` placeholders, in order. */
  async runQueryWith(name, parameters) {
    const text = await this.#statementText(name);
    const started = await this.#afterEarlierChanges(() => this.#startPreparedQuery(text, parameters));
    return plainRows(await started.result);
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

  /**
   * Fetch every week's row files into DuckDB's memory, newest week first, calling `onProgress({ streamedWeeks })` after
   * each week with the Sundays streamed so far; return at once, doing nothing, when `STREAM_ROWS_AFTER_DRAW` is false.
   * A page calls it once, after its first view is drawn. A failure stops the stream with one console warning.
   */
  async streamRows(onProgress) {
    if (!STREAM_ROWS_AFTER_DRAW) {
      return;
    }
    try {
      const opened = await this.#duckdb();
      const swapIn = (name, bytes) => this.#afterEarlierChanges(() => this.#swapWhenIdle(opened, name, bytes));
      await streamWeekFiles(this.#dataUrl, streamingOrder(this.#weeks, ROW_KINDS), swapIn, onProgress);
    } catch (error) {
      // The stream only speeds up later queries, which read HTTP ranges without it; so it stops and the page goes on.
      console.warn(`Streaming the weeks' rows stopped: ${error.message}`);
    }
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

  /** Start the query `text` on the selection tables holding the latest selection: `{ result }`, as `#running` gives. */
  async #startQuery(text) {
    const connection = await this.#connectionWithSelection();
    return this.#running(connection.query(text));
  }

  /** Start the query `text` with `parameters`, closing its statement after: `{ result }`, as `#running` gives. */
  async #startPreparedQuery(text, parameters) {
    const { connection } = await this.#duckdb();
    const statement = await connection.prepare(text);
    return this.#running(queryAndClose(statement, parameters));
  }

  /**
   * `{ result }`, `result` being the promised result of a query just started, counted as running until it settles. It
   * is wrapped so that the turn that started the query settles without waiting for it.
   */
  #running(result) {
    this.#runningQueries.add(result);
    const forget = () => this.#runningQueries.delete(result);
    result.then(forget, forget);
    return { result };
  }

  /** Register the file `name` as `bytes` once the running queries have settled; no query starts meanwhile. */
  async #swapWhenIdle({ engine, httpProtocol }, name, bytes) {
    await Promise.allSettled([...this.#runningQueries]);
    await swapFileToMemory(engine, this.#dataUrl, name, bytes, httpProtocol);
  }

  /** The DuckDB connection, its selection tables holding the latest selection when one has been set. */
  async #connectionWithSelection() {
    const { connection } = await this.#duckdb();
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
    const { connection } = await this.#duckdb();
    await this.#runStatement(connection, "setup/clear_selected_session");
    await this.#runEach(connection, "setup/insert_selected_session", [[week, rootSessionId]]);
  }

  /** DuckDB, `{ engine, connection, httpProtocol }`, opened over the weeks' files the first time it is asked for. */
  #duckdb() {
    this.#opening ??= openDuckDB(this.#dataUrl, this.#weeks, this.#harnesses, (name) => this.#statementText(name));
    return this.#opening;
  }

  async #runStatement(connection, name) {
    await runStatement(connection, await this.#statementText(name));
  }

  async #runEach(connection, name, parameterLists) {
    await runEach(connection, await this.#statementText(name), parameterLists);
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

/** The result of the prepared `statement` run with `parameters`; the statement is closed whatever the outcome. */
async function queryAndClose(statement, parameters) {
  try {
    return await statement.query(...parameters);
  } finally {
    await statement.close();
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
