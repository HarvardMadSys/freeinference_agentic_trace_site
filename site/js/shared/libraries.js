/**
 * The browser libraries the site uses, each loaded from the CDN at an exact version.
 *
 * This is the only module that names a library URL. A page that needs a
 * library imports it from here, so a version is changed in one place.
 */

import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm";

export { duckdb, Plot };
