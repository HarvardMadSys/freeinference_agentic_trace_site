/**
 * The Tools section of the Explore page's figures: how long a tool call waits and how much it returns, per category,
 * how requests batch their calls, drawn in `tools_batching.js`, and the tool mix along a turn, human-driven against
 * benchmark, drawn in `comparison/tool_mix.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of a quantile-range query is one
 * category, its count in `rows`, so a thin one is hidden whole; the ranges kind (`charts/ranges.js`) draws them.
 */

import { formatCompactCount, formatCountTick, formatSeconds, MILLISECONDS_PER_SECOND } from "../shared/format.js";
import { drawRanges } from "../charts/ranges.js";
import { CALLS_PER_REQUEST_BY_CATEGORY, LATENCY_BY_BATCH_WIDTH } from "./tools_batching.js";
import { TOOL_MIX_BY_TURN_POSITION } from "../comparison/tool_mix.js";

const MIN_LATENCY_DRAWN_S = 0.1; // seconds; a shorter wait is drawn at it, as in the paper, whose axis starts at 100 ms
const MIN_RESULT_TOKENS_DRAWN = 1; // an empty result is drawn at one token, below the shortest messages

/** The Tools topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Most requests call one tool; calling tools together can reduce total waiting time.";

/** The figures of the Tools section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "latency_by_category",
    title: "Tool latency by category",
    insight: "Even simple tools can have surprisingly long delays.",
    definition: "Tool wait times by category, counting only requests that call one tool. Wait time starts when the model response ends and stops at the next request; boxes show the middle 50% and whiskers show the 5th–95th percentiles. An asterisk marks shell commands grouped by what they do.",
    caption: "Read, Edit, Search, and File Ops have median latencies near one second, while Build/Test and Subagent calls take much longer. Long tails mean even fast categories occasionally stall for minutes.",
    query: "figures/latency_by_category",
    binColumn: "category",
    draw: (rows, body, colours) => drawRanges(rows, body, colours, {
      unitFactor: 1 / MILLISECONDS_PER_SECOND,
      floor: MIN_LATENCY_DRAWN_S,
      xLabel: "Seconds",
      valueFormat: formatSeconds,
      xTickFormat: String,
    }),
  }),
  Object.freeze({
    name: "result_tokens_by_category",
    title: "Tool result size by category",
    insight: "Reading code contributes far more context than writing it.",
    definition: "Tokens returned by each tool category, counting only calls with a known result. Boxes show the middle 50% and whiskers show the 5th–95th percentiles. An asterisk marks shell commands grouped by what they do.",
    caption: "Read operations produce 33.9% of tool-result tokens despite accounting for only 16.3% of calls. Edit and Write operations typically return fewer than 50 tokens.",
    query: "figures/result_tokens_by_category",
    binColumn: "category",
    draw: (rows, body, colours) => drawRanges(rows, body, colours, {
      unitFactor: 1,
      floor: MIN_RESULT_TOKENS_DRAWN,
      xLabel: "Tokens",
      valueFormat: formatCompactCount,
      xTickFormat: formatCountTick,
    }),
  }),
  CALLS_PER_REQUEST_BY_CATEGORY,
  LATENCY_BY_BATCH_WIDTH,
  TOOL_MIX_BY_TURN_POSITION,
]);
