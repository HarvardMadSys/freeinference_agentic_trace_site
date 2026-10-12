/**
 * The Benchmark-against-production section of the Explore page's figures: how the benchmark's sessions differ from
 * the human-driven ones.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines, drawn in its own module of this folder.
 */

import { TOOL_MIX_BY_TURN_POSITION } from "./tool_mix.js";

/** The figures of the Benchmark-against-production section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  TOOL_MIX_BY_TURN_POSITION,
]);
