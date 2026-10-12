/**
 * The Human-driven-against-benchmark section of the Explore page's figures: how the benchmark's sessions differ from
 * the human-driven ones.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines, drawn in a module of this folder:
 * `scope_cdfs.js` the CDFs of the two scopes side by side, and `tool_mix.js` the tool mix along a turn. `scopes.js`
 * names the two scopes and draws their legend.
 */

import {
  INPUT_PER_REQUEST_BY_SCOPE, SESSION_DURATION_BY_SCOPE, TURN_DURATION_BY_SCOPE, USER_PROMPT_TOKENS_BY_SCOPE,
} from "./scope_cdfs.js";
import { TOOL_MIX_BY_TURN_POSITION } from "./tool_mix.js";

/** The figures of the Human-driven-against-benchmark section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  TURN_DURATION_BY_SCOPE,
  SESSION_DURATION_BY_SCOPE,
  INPUT_PER_REQUEST_BY_SCOPE,
  USER_PROMPT_TOKENS_BY_SCOPE,
  TOOL_MIX_BY_TURN_POSITION,
]);
