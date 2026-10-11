/**
 * The weeks' row files as DuckDB sees them, and the stream that moves them into memory.
 *
 * A data file is `<kind>/week=<sunday>/rows.parquet` under the data folder, registered with DuckDB under that name:
 * first as a URL it reads in HTTP ranges, and, once the stream has fetched the whole file, as the file's bytes in
 * memory. The views name files, not URLs, so a query reads whichever the name is registered as when it runs.
 */

// The placeholder in a view statement that stands for its files' names, each single-quoted, separated by commas.
const FILES_PLACEHOLDER = "{files}";

// The one kind of row whose files only the simulated weeks have.
const SIMULATION_KIND = "simulation";

// The priority of a streamed file's fetch: below anything the page asks for while it draws. A browser that does not
// know the option ignores it.
const STREAM_FETCH_PRIORITY = "low";

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

/**
 * The files to stream, one entry per week of `weeks` (the entries of `weeks.json`, oldest first), newest week first:
 * `[{ week, names }]`, `names` holding the week's file of each of `kinds` it has one of, in the order of `kinds`.
 */
export function streamingOrder(weeks, kinds) {
  const order = [];
  for (const entry of [...weeks].reverse()) {
    const names = [];
    for (const kind of kinds) {
      names.push(...weekFileNames(kind, [entry]));
    }
    order.push({ week: entry.week, names });
  }
  return order;
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

/** Register each of `fileNames` with `engine` under its own name, as the URL of that file in the data folder. */
export async function registerFiles(engine, dataUrl, fileNames, httpProtocol) {
  for (const name of fileNames) {
    // HTTP, so DuckDB reads the file in ranges as it reads a URL named in a query; direct I/O off, the library's default.
    await engine.registerFileURL(name, fileUrl(dataUrl, name), httpProtocol, false);
  }
}

/** Register the file `name` with `engine` as `bytes` (a Uint8Array, handed over to DuckDB) in place of its URL. */
export async function swapFileToMemory(engine, name, bytes) {
  await engine.dropFile(name);
  await engine.registerFileBuffer(name, bytes);
}

/**
 * Fetch the files of `order` (as `streamingOrder` gives them) from the data folder at `dataUrl`, one at a time, and
 * hand each to `swapIn(name, bytes)`; after each week, call `onProgress({ streamedWeeks })` with the Sundays of the
 * weeks streamed so far, newest first. Stops for good when the page is hidden. A failed fetch rejects.
 */
export async function streamWeekFiles(dataUrl, order, swapIn, onProgress) {
  const leaving = new AbortController();
  function stopWhenHidden() {
    if (document.visibilityState === "hidden") {
      leaving.abort();
    }
  }
  stopWhenHidden();
  document.addEventListener("visibilitychange", stopWhenHidden);
  try {
    await streamUntilAborted({ dataUrl, order, swapIn, onProgress }, leaving.signal);
  } finally {
    document.removeEventListener("visibilitychange", stopWhenHidden);
  }
}

/** `stream` is `{ dataUrl, order, swapIn, onProgress }`, as `streamWeekFiles` was given them. */
async function streamUntilAborted(stream, signal) {
  const streamedWeeks = [];
  for (const { week, names } of stream.order) {
    for (const name of names) {
      const bytes = await fetchUnlessAborted(fileUrl(stream.dataUrl, name), signal);
      if (bytes === null) {
        return;
      }
      await stream.swapIn(name, bytes);
    }
    streamedWeeks.push(week);
    stream.onProgress({ streamedWeeks: [...streamedWeeks] });
  }
}

/** The bytes of the file at `url`; null when `signal` is aborted before or while it is fetched. */
async function fetchUnlessAborted(url, signal) {
  if (signal.aborted) {
    return null;
  }
  try {
    const response = await fetch(url, { priority: STREAM_FETCH_PRIORITY, signal });
    if (!response.ok) {
      throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    // Leaving the page aborts the fetch; that ends the stream, it is not a failure.
    if (signal.aborted) {
      return null;
    }
    throw error;
  }
}
