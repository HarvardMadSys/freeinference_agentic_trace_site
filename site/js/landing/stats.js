/**
 * The stats strip beside the hero: the weeks, sessions, requests, input tokens, tool calls and harnesses of the
 * selection (while the figures are frozen, every week and the paper's harnesses), and a line naming the span of its
 * days and the weeks the cache simulation covers. The counts come from the `explore/headline_numbers` answer and the
 * selection; none is typed.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`.
 */

import { showError, showLoading } from "../shared/charts.js";
import { dateSpanText, formatCompactCount, formatCount } from "../shared/format.js";

/** Show the loading state in `container`. */
export function layoutStats(container) {
  showLoading(container);
}

/** Draw the stats strip into `container` from the headline answer and the selection, or the error if the query fails. */
export async function runStats(container, context) {
  await drawStats(container, context).catch((error) => showError(container, error));
}

/**
 * The strip's numbers `[{ value, label }]`: the selection's weeks, then the headline row's top-level sessions,
 * requests, input tokens and tool calls, then the selection's harnesses. The three largest are written compactly.
 */
export function statsRows(headlineRow, selection) {
  return [
    { value: formatCount(selection.weeks.length), label: "weeks" },
    { value: formatCount(headlineRow.sessions), label: "sessions" },
    { value: formatCompactCount(headlineRow.requests), label: "requests" },
    { value: formatCompactCount(headlineRow.input_tokens), label: "input tokens" },
    { value: formatCompactCount(headlineRow.tool_calls), label: "tool calls" },
    { value: formatCount(selection.harnesses.length), label: "harnesses" },
  ];
}

async function drawStats(container, context) {
  const rows = await context.database.runQuery("explore/headline_numbers");
  const selectedWeeks = context.weeks.filter((entry) => context.selection.weeks.includes(entry.week));
  const items = statsRows(rows[0], context.selection).map(
    (stat) => `<li><strong>${stat.value}</strong><span>${stat.label}</span></li>`,
  );
  container.innerHTML = `
    <ul class="stats-grid" aria-label="The trace in numbers">${items.join("")}</ul>
    <p class="stats-dates">${datesLine(selectedWeeks)}</p>`;
}

/**
 * The line under the numbers, from the first week's Sunday to the last week's Saturday and the weeks the cache
 * simulation covers: "May 17 to September 5, 2026; the cache simulation covers all 16 weeks." ("covers all but
 * 2026-08-16", "covers its week", "covers no week"); "" when there is no week.
 */
export function datesLine(weeks) {
  if (weeks.length === 0) {
    return "";
  }
  const days = dateSpanText(weeks[0].week, weeks.at(-1).last_day);
  return `${days}; the cache simulation covers ${simulationCoverage(weeks)}.`;
}

// Which of `weeks` the cache simulation covers, in words.
function simulationCoverage(weeks) {
  const unsimulated = weeks.filter((entry) => !entry.simulated).map((entry) => entry.week);
  if (unsimulated.length === weeks.length) {
    return "no week";
  }
  if (unsimulated.length > 0) {
    return `all but ${unsimulated.join(", ")}`;
  }
  return weeks.length === 1 ? "its week" : `all ${weeks.length} weeks`;
}
