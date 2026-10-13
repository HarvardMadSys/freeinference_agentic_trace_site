/**
 * The Explore page's data: the weeks `weeks.json` lists, the harnesses `harnesses.json` lists, and the answers of the
 * queries. `make data` runs every query under `site/queries/explore/` and `site/queries/figures/`, and the colour
 * orders `setup/*_order`, and writes each one's rows to `data/all_weeks/<name>.json`, `name` being the query's path
 * under `site/queries/` without `.sql`: `runQuery("explore/trace_totals")` reads
 * `data/all_weeks/explore/trace_totals.json`.
 */

// The indexes of weeks and harnesses, relative to a page.
const WEEKS_FILE = "data/weeks.json";
const HARNESSES_FILE = "data/harnesses.json";

// The folder of the answers, relative to a page: the query `name`'s answer is `<folder><name>.json`.
const ANSWERS_FOLDER = "data/all_weeks/";

/** The entries of `data/weeks.json`, oldest first: `{ week, last_day, month, simulated }`. */
export async function fetchWeeks() {
  return (await fetchFile(WEEKS_FILE)).json();
}

/** The entries of `data/harnesses.json`, most sessions first: `{ harness, sessions, benchmark }`. */
export async function fetchHarnesses() {
  return (await fetchFile(HARNESSES_FILE)).json();
}

/** The rows of the query `name`, read from its answer file: each an object from column name to value. */
export async function runQuery(name) {
  return (await fetchFile(`${ANSWERS_FOLDER}${name}.json`)).json();
}

/** The response to fetching `file` relative to the page; throws naming the file if it cannot be fetched. */
async function fetchFile(file) {
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Could not fetch ${file}: ${response.status} ${response.statusText}`);
  }
  return response;
}
