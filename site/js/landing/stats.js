/**
 * The stats strip beside the hero: the whole trace as the paper's summary table counts it, the weeks, top-level
 * sessions, their requests, input tokens and tool calls, and the harnesses, the benchmark's written apart ("13 (+1)"),
 * and a line naming the span of its days. The counts come from the `explore/trace_totals` answer, which the data step
 * answers over every week and every harness, and from the weeks of `weeks.json`; none is typed.
 *
 * A section's `context` is what the page gives every section; see `explore/start.js`.
 */

import { showError, showLoading } from "../shared/charts.js";
import { runQuery } from "../shared/database.js";
import { dateSpanText, formatCompactCount, formatCount } from "../shared/format.js";

/**
 * Show the loading state in `container`, then draw the stats strip into it from the trace totals and the weeks, or the
 * error if the query fails.
 */
export async function runStats(container, context) {
  showLoading(container);
  await drawStats(container, context).catch((error) => showError(container, error));
}

/**
 * The strip's numbers `[{ value, label }]`: the number of `weeks` (the entries of `weeks.json`), then the totals row's
 * top-level sessions, requests, input tokens and tool calls, and its harnesses. The three largest are written
 * compactly.
 */
export function statsRows(totalsRow, weeks) {
  return [
    { value: formatCount(weeks.length), label: "weeks" },
    { value: formatCount(totalsRow.sessions), label: "sessions" },
    { value: formatCompactCount(totalsRow.requests), label: "requests" },
    { value: formatCompactCount(totalsRow.input_tokens), label: "input tokens" },
    { value: formatCompactCount(totalsRow.tool_calls), label: "tool calls" },
    { value: harnessesText(totalsRow), label: "harnesses" },
  ];
}

/**
 * The harnesses as the paper's summary table writes them, the benchmark's apart: 14 harnesses of which 1 is the
 * benchmark's → "13 (+1)"; with no benchmark harness, the count alone.
 */
export function harnessesText({ harnesses, benchmark_harnesses: benchmarkHarnesses }) {
  const others = formatCount(harnesses - benchmarkHarnesses);
  return benchmarkHarnesses === 0 ? others : `${others} (+${formatCount(benchmarkHarnesses)})`;
}

async function drawStats(container, context) {
  const rows = await runQuery("explore/trace_totals");
  const items = statsRows(rows[0], context.weeks).map(
    (stat) => `<li><strong>${stat.value}</strong><span>${stat.label}</span></li>`,
  );
  container.innerHTML = `
    <ul class="stats-grid" aria-label="The trace in numbers">${items.join("")}</ul>
    <p class="stats-dates">${datesLine(context.weeks)}</p>`;
}

/**
 * The line under the numbers, the span of the weeks from the first week's Sunday to the last week's Saturday: "May 17 –
 * September 5, 2026"; "" when there is no week.
 */
export function datesLine(weeks) {
  if (weeks.length === 0) {
    return "";
  }
  return dateSpanText(weeks[0].week, weeks.at(-1).last_day);
}
