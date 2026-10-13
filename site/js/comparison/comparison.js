/**
 * The Human-driven-against-benchmark section of the Explore page's figures: how long the benchmark's turns and
 * sessions last and how much input its requests hold, against the human-driven ones'.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines, taken from `scope_cdfs.js` and drawn by the CDF
 * kind. The folder's other figures that compare the two scopes, the user prompt size and the tool mix along a turn,
 * are listed in the Session-structure and Tools sections.
 */

import { INPUT_PER_REQUEST_BY_SCOPE, SESSION_DURATION_BY_SCOPE, TURN_DURATION_BY_SCOPE } from "./scope_cdfs.js";

/** The Human-driven-against-benchmark topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Human sessions last longer and use larger inputs than SWE-Bench sessions.";

/** The figures of the Human-driven-against-benchmark section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  TURN_DURATION_BY_SCOPE,
  SESSION_DURATION_BY_SCOPE,
  INPUT_PER_REQUEST_BY_SCOPE,
]);
