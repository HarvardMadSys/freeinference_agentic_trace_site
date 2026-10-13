/**
 * The figures that rank sessions by a share and stack each rank bin's mean shares, drawn by the ranked kind
 * (`charts/ranked.js`): how a session's cost splits between its token parts, listed in `tokens.js`, and how its time
 * splits between prefill, decode, tool wait and user idle, listed in `latency.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of their queries is one rank bin, as
 * the ranked kind reads it, and also holds the same `ranked_bin` and `rows`, the sessions ranked: the page counts the
 * figure's rows as one bin, so the figure is hidden only when the whole answer has too few sessions, not when its rank
 * bins are small.
 */

import { drawRanked, rankedLegend } from "../charts/ranked.js";
import { TIME_PART_COLOURS, TIME_PART_NAMES, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { TOKEN_PART_NAMES } from "../session/token_parts.js";

// The parts of a session's cost, bottom up in the stack, with the label each is drawn under.
const COST_PARTS = TOKEN_PART_NAMES;

// The parts of a session's time, bottom up in the stack as the paper stacks them, with the label each is drawn under.
const TIME_PARTS = TIME_PART_NAMES;

/** The cost share figure: each session's cost split between its token parts, sessions ranked by cached share. */
export const COST_SHARE_BY_SESSION = Object.freeze({
  name: "cost_share_by_session",
  title: "Cost breakdown by session",
  insight: "Even discounted cache reads become the biggest API expense.",
  definition: "The percentage of each session’s API cost spent on each token type. Prices are $1 per 1 million cached input tokens, $10 per 1 million uncached input tokens, and $50 per 1 million output tokens. Only requests with reported cache usage count; sessions are sorted by cached cost percentage, then averaged in groups.",
  caption: "Cached input accounts for 72.9% of modeled API cost, despite costing one-tenth as much per token as uncached input. Its enormous volume outweighs the pricing discount.",
  query: "figures/cost_share_by_session",
  binColumn: "ranked_bin",
  legend: (rows) => rankedLegend(rows, new Map(Object.entries(TOKEN_PART_COLOURS)), { parts: COST_PARTS }),
  draw: (rows, body, colours, hidden) => drawRanked(rows, body, colours, {
    parts: COST_PARTS,
    yLabel: "Share of cost",
  }, hidden),
});

/** The session time figure: each session's time in prefill, decode, tool wait and user idle, ranked by idle share. */
export const SESSION_TIME_BY_PART = Object.freeze({
  name: "session_time_by_part",
  title: "Where session time goes",
  insight: "Most session time is spent outside the LLM.",
  definition: "Each main session’s time is split into input processing, output generation, tool or subagent waits, and user waits. Sessions are sorted by the percentage of time spent waiting for users, then averaged in groups. Input processing time is estimated using time to first token.",
  caption: "User idle time accounts for 50.3% of session duration and tool execution another 21.7%. Prefill and decoding together account for the remaining 28%.",
  query: "figures/session_time_by_part",
  binColumn: "ranked_bin",
  legend: (rows) => rankedLegend(rows, new Map(Object.entries(TIME_PART_COLOURS)), { parts: TIME_PARTS }),
  draw: (rows, body, colours, hidden) => drawRanked(rows, body, colours, {
    parts: TIME_PARTS,
    yLabel: "Share of session time",
  }, hidden),
});
