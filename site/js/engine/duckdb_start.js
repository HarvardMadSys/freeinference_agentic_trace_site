/**
 * Starting DuckDB-WASM in the page: the library loaded from the CDN, its database running in a worker.
 */

// Query results give 64- and 128-bit integers (a SUM) and decimals as numbers; every count and total fits a double.
const QUERY_CONFIG = Object.freeze({ castBigIntToDouble: true, castDecimalToDouble: true });

/** The DuckDB-WASM module and a database of it in a worker, open and ready to connect to: `{ duckdb, engine }`. */
export async function startDuckDB() {
  // Loaded here, not imported at the top, so node can load the modules that import this one for the tests.
  const { loadDuckDB } = await import("../shared/libraries.js");
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
