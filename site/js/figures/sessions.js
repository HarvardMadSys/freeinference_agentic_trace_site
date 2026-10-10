/**
 * The Sessions section of the Paper figures page: how long sessions are, and how their tokens are spent.
 *
 * Each figure is `{ name, title, definition, query, binColumn, seriesOverSameRows, draw }`: `name` is the
 * figure's id and element id, `query` the query it draws, `binColumn` the column naming the bin or series each
 * row belongs to (a bin under the page's row threshold is hidden whole), `seriesOverSameRows` whether every
 * series is drawn from the same rows, and `draw(rows, body, colours)` draws the rows into `body`.
 */

import { drawCdf } from "../shared/charts.js";
import { formatCount } from "../shared/format.js";
import { cdfSeries } from "./figure_rows.js";

// The series of the requests-per-session CDF, by their name in the query, with the name each is drawn under.
const SESSION_COUNT_SERIES = Object.freeze({
  requests: "Requests",
  user_steps: "User steps",
  tool_steps: "Tool steps",
});

// A count below one (a session with no tool step) is drawn at one, so it has a place on the log axis.
const MIN_COUNT_DRAWN = 1;

/** The figures of the Sessions section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "requests_per_session_cdf",
    title: "Requests and steps per session",
    definition: "CDF over top-level sessions of their requests, user steps and tool steps; a session with no tool step is drawn at one.",
    query: "figures/requests_per_session_cdf",
    binColumn: "series",
    seriesOverSameRows: true,
    draw: drawRequestsPerSession,
  }),
]);

/** Draw the CDFs of requests, user steps and tool steps per session, on a log axis. */
async function drawRequestsPerSession(rows, body) {
  const series = cdfSeries(rows, SESSION_COUNT_SERIES, MIN_COUNT_DRAWN);
  await drawCdf(body, series, { xLabel: "Per session", logX: true, format: formatCount });
}
