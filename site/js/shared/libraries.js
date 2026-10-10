/**
 * The browser libraries the site uses, each loaded from the CDN at an exact version.
 *
 * This is the only module that names a library URL. A page that needs a
 * library imports it from here, so a version is changed in one place.
 */

// DuckDB-WASM is pinned to 1.29.0: it reads a Parquet file over HTTP in ranges
// (about 1 MB for a one-week count), while 1.30.0 to 1.32.0 download whole
// files, which the site's design rules out. Re-measure before raising it.
import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm";

export { duckdb, Plot };
