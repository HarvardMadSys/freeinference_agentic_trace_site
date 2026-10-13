/**
 * The two scopes the figures compare, by the pipeline's name of each (`population.AGENTIC` and
 * `population.SWE_BENCH`), as the simulation's rows and the scope queries give it: the human-driven sessions, those of
 * the paper's harnesses or the selected harnesses but the benchmark's, and the benchmark replay's. Their colours are
 * `SCOPE_COLOURS` in `theme/colours.js`.
 */

import { seriesLegend } from "../shared/series.js";
import { SCOPE_COLOURS } from "../theme/colours.js";

/** Each scope's label, as the paper names it, in the order the figures draw the scopes. */
export const SCOPE_LABELS = Object.freeze({
  Agentic: "Human-driven",
  "SWE-Bench": "Benchmark",
});

/** The scopes, in the order the figures draw them. */
export const SCOPES = Object.freeze(Object.keys(SCOPE_LABELS));

/** The legend of a figure of both scopes: the scopes of the rows, human-driven then benchmark, in their colours. */
export function scopeLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, new Map(Object.entries(SCOPE_COLOURS)), SCOPE_LABELS);
}
