/**
 * The eight distribution cards of the top-level requests and sessions in the selected weeks and harnesses:
 * each a histogram of the bins its `<name>_bins` query computed, with the exact percentiles, count and
 * maximum of its `<name>_stats` query. A card whose queries fail shows its error in its own place.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`.
 */

import { showError, showLoading } from "../shared/charts.js";
import { formatCount, formatSeconds, formatShare, formatTokens } from "../shared/format.js";
import { binsFromRows, mountHistogram } from "../shared/histogram.js";

// What a log card adds to its definition when its quantity can be 0: a log axis has no place for 0.
const ZERO_NOTE = "A value of 0 is counted in n and the percentiles but not drawn.";

// Each card: its name (the prefix of its two query files), title, definition, what it counts, format and scale.
const CARDS = Object.freeze([
  Object.freeze({
    name: "input_tokens", title: "Input tokens per request", countLabel: "Requests", format: formatTokens, logScale: true,
    definition: `Prompt tokens of each top-level request. ${ZERO_NOTE}`,
  }),
  Object.freeze({
    name: "uncached_tokens", title: "Uncached input tokens per request", countLabel: "Requests", format: formatTokens,
    logScale: true,
    definition: `Input minus cached tokens of each top-level request whose provider reports cache reads. ${ZERO_NOTE}`,
  }),
  Object.freeze({
    name: "output_tokens", title: "Output tokens per request", countLabel: "Requests", format: formatTokens, logScale: true,
    definition: `Completion tokens of each top-level request. ${ZERO_NOTE}`,
  }),
  Object.freeze({
    name: "requests_per_session", title: "Requests per session", countLabel: "Sessions", format: formatCount,
    logScale: true, definition: "LLM requests of each top-level session, its subagents' not counted.",
  }),
  Object.freeze({
    name: "turns_per_session", title: "Turns per session", countLabel: "Sessions", format: formatCount, logScale: true,
    definition: "User steps of each top-level session: the requests whose new input is a user message.",
  }),
  Object.freeze({
    name: "subagents_per_session", title: "Subagents per session", countLabel: "Sessions", format: formatCount,
    logScale: true, definition: `Subagent sessions each top-level session spawned, at any depth. ${ZERO_NOTE}`,
  }),
  Object.freeze({
    name: "session_duration", title: "Session duration", countLabel: "Sessions", format: formatSeconds, logScale: true,
    definition: "Each top-level session's last completion minus its first arrival.",
  }),
  Object.freeze({
    name: "cached_fraction", title: "Cached fraction per request", countLabel: "Requests", format: formatShare,
    logScale: false,
    definition: "Cached over input tokens of each top-level request whose provider reports cache reads, at most 1.",
  }),
]);

/** Fill `container` with one place per card, each loading; return the places in the cards' order. */
export function layoutDistributions(container) {
  const places = [];
  for (const card of CARDS) {
    const place = document.createElement("div");
    place.className = "card";
    place.id = card.name;
    showLoading(place);
    places.push(place);
  }
  container.replaceChildren(...places);
  return places;
}

/** Lay out the cards in `container` and draw each from its two queries. */
export async function runDistributions(container, context) {
  const places = layoutDistributions(container);
  const drawings = [];
  for (const [index, card] of CARDS.entries()) {
    const place = places[index];
    drawings.push(drawCard(place, card, context).catch((error) => showError(place, error)));
  }
  await Promise.all(drawings);
}

/** The histogram card of `card` from its bins query's rows and its stats query's one row, as `mountHistogram` takes it. */
export function histogramCard(card, binRows, statsRow) {
  return {
    ...card,
    bins: binsFromRows(binRows),
    percentiles: { p50: statsRow.p50, p75: statsRow.p75, p90: statsRow.p90, p95: statsRow.p95 },
    count: statsRow.count,
    max: statsRow.max,
  };
}

async function drawCard(place, card, context) {
  const binRows = await context.database.runQuery(`explore/${card.name}_bins`);
  const statsRows = await context.database.runQuery(`explore/${card.name}_stats`);
  await mountHistogram(place, histogramCard(card, binRows, statsRows[0]));
}
