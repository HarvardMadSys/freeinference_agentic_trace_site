/**
 * The weeks' row files as DuckDB sees them, and the fetches that move them into memory: the stream of every week's
 * files, and one week's files loaded whole.
 *
 * A data file is `<kind>/week=<sunday>/rows.parquet` under the data folder, registered with DuckDB under that name:
 * first as a URL it reads in HTTP ranges, and, once the whole file has been fetched, as the file's bytes in
 * memory. The views name files, not URLs, so a query reads whichever the name is registered as when it runs.
 */

// The placeholder in a view statement that stands for its files' names, each single-quoted, separated by commas.
const FILES_PLACEHOLDER = "{files}";

// The one kind of row whose files only the simulated weeks have.
const SIMULATION_KIND = "simulation";

// The priority of a whole file's fetch: below anything else the page asks for while it draws. A browser that does not
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
    order.push({ week: entry.week, names: filesOfWeek(entry, kinds) });
  }
  return order;
}

/** The names of the files of one week, `entry` (an entry of `weeks.json`): one of each of `kinds` it has, in order. */
export function filesOfWeek(entry, kinds) {
  const names = [];
  for (const kind of kinds) {
    names.push(...weekFileNames(kind, [entry]));
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

/** Register each of `fileNames` with `engine` under its own name, as the URL of that file in the data folder. */
export async function registerFiles(engine, dataUrl, fileNames, httpProtocol) {
  for (const name of fileNames) {
    // HTTP, so DuckDB reads the file in ranges as it reads a URL named in a query; direct I/O off, the library's default.
    await engine.registerFileURL(name, fileUrl(dataUrl, name), httpProtocol, false);
  }
}

/**
 * Register the file `name` with `engine` as `bytes` (a Uint8Array, handed over to DuckDB) in place of its URL. When the
 * bytes cannot be registered, the file's URL in the data folder at `dataUrl` is registered again, as `registerFiles`
 * registers it, before the error is thrown: a query on the file then reads its ranges as before.
 */
export async function swapFileToMemory(engine, dataUrl, name, bytes, httpProtocol) {
  await engine.dropFile(name);
  try {
    await engine.registerFileBuffer(name, bytes);
  } catch (error) {
    await registerFiles(engine, dataUrl, [name], httpProtocol);
    throw error;
  }
}

/**
 * Fetch the files of `order` (as `streamingOrder` gives them) from the data folder at `dataUrl`, one at a time, and
 * hand each to `swapIn(name, bytes)`; after each week, call `onProgress({ streamedWeeks })` with the Sundays of the
 * weeks streamed so far, newest first. While the page is hidden the stream pauses, and a fetch under way is dropped;
 * once the page is visible again it goes on from the file it had not finished. A failed fetch rejects.
 */
export async function streamWeekFiles(dataUrl, order, swapIn, onProgress) {
  const streamedWeeks = [];
  for (const { week, names } of order) {
    for (const name of names) {
      await swapIn(name, await fetchWhileVisible(fileUrl(dataUrl, name)));
    }
    streamedWeeks.push(week);
    onProgress({ streamedWeeks: [...streamedWeeks] });
  }
}

/**
 * Fetch each of the files `names` whole from the data folder at `dataUrl`, one request each and one at a time, and
 * hand each to `swapIn(name, bytes)`. A file that cannot be fetched or swapped in is named in a console warning and
 * left as it was registered, read over HTTP ranges; the files after it are still fetched.
 */
export async function loadFilesWhole(dataUrl, names, swapIn) {
  for (const name of names) {
    try {
      await swapIn(name, await fetchWhileVisible(fileUrl(dataUrl, name)));
    } catch (error) {
      // The file in memory only spares the queries their range reads; without it they read the ranges.
      console.warn(`Reading ${name} over HTTP ranges: ${error.message}`);
    }
  }
}

/** The bytes of the file at `url`, fetched while the page is visible: a fetch the page's hiding cut off is redone. */
async function fetchWhileVisible(url) {
  let bytes = null;
  while (bytes === null) {
    await pageVisible();
    bytes = await fetchUnlessHidden(url);
  }
  return bytes;
}

/** Settles at once while the page is visible; otherwise when it next becomes visible. */
function pageVisible() {
  if (document.visibilityState !== "hidden") {
    return Promise.resolve();
  }
  // While the page is hidden, its next change of visibility is to visible.
  return new Promise((resolve) => document.addEventListener("visibilitychange", resolve, { once: true }));
}

/** The bytes of the file at `url`; null when the page is hidden while it is fetched, which aborts the fetch. */
async function fetchUnlessHidden(url) {
  const hiding = new AbortController();
  function abortWhenHidden() {
    if (document.visibilityState === "hidden") {
      hiding.abort();
    }
  }
  document.addEventListener("visibilitychange", abortWhenHidden);
  try {
    const response = await fetch(url, { priority: STREAM_FETCH_PRIORITY, signal: hiding.signal });
    if (!response.ok) {
      throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    // Hiding the page aborts the fetch: no failure, as the stream fetches the file again once the page is visible.
    if (hiding.signal.aborted) {
      return null;
    }
    throw error;
  } finally {
    document.removeEventListener("visibilitychange", abortWhenHidden);
  }
}
