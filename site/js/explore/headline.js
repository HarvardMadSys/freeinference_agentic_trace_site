/**
 * The headline numbers of the top-level sessions in the selected weeks and harnesses, each with a short phrase under
 * it and its definition on hover, and the model mix: each model's share of their requests, largest first, coloured by
 * the global model order so a model has the same colour on every page; the models under 1% share one muted pill.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`.
 */

import { showError, showLoading, showNote } from "../shared/charts.js";
import { assignColours } from "../theme/colours.js";
import { cachedShare, formatCount, formatOptionalShare, formatShare, formatTokens } from "../shared/format.js";
import { statStrip } from "../shared/tiles.js";

// Each headline number read straight from the query's one row: its label, column, format, the short phrase under it
// and its definition.
const HEADLINE_NUMBERS = Object.freeze([
  Object.freeze({ label: "Sessions", column: "sessions", format: formatCount, detail: "top-level",
    definition: "Top-level sessions: those no other session spawned." }),
  Object.freeze({ label: "Accounts", column: "accounts", format: formatCount, detail: "distinct users",
    definition: "Distinct accounts (user ids) that ran them." }),
  Object.freeze({ label: "Requests", column: "requests", format: formatCount, detail: "of top-level sessions",
    definition: "LLM requests of the top-level sessions." }),
  Object.freeze({ label: "Input tokens", column: "input_tokens", format: formatTokens, detail: "prompt tokens",
    definition: "Prompt tokens of those requests." }),
  Object.freeze({ label: "Output tokens", column: "output_tokens", format: formatTokens, detail: "completion tokens",
    definition: "Completion tokens of those requests." }),
  Object.freeze({ label: "Tool calls", column: "tool_calls", format: formatCount, detail: "emitted by responses",
    definition: "Tool calls their responses made." }),
  Object.freeze({ label: "Subagents", column: "subagents", format: formatCount, detail: "spawned, at any depth",
    definition: "Subagent sessions they spawned, at any depth." }),
]);

// The phrase under the cached share, the one headline number computed from two columns, and its definition.
const CACHED_SHARE_DETAIL = "of reported input";
const CACHED_SHARE_DEFINITION = "Cached tokens over the input of the requests whose provider reports cache reads.";

// A model with a smaller share of the requests than this gets no pill of its own: it is counted in the others' pill.
const MIN_SHARE_WITH_PILL = 0.01;

/** Show the loading state in `container`. */
export function layoutHeadline(container) {
  showLoading(container);
}

/** Draw the headline numbers and the model mix into `container`; each shows its own error if its query fails. */
export async function runHeadline(container, context) {
  const numbers = document.createElement("div");
  const mix = document.createElement("div");
  showLoading(numbers);
  showLoading(mix);
  const places = document.createElement("div");
  places.className = "figure-section";
  places.append(numbers, mix);
  container.replaceChildren(places);
  await Promise.all([
    drawNumbers(numbers, context).catch((error) => showError(numbers, error)),
    drawModelMix(mix, context).catch((error) => showError(mix, error)),
  ]);
}

/**
 * The tiles `{ label, value, detail, definition }` of the headline query's row, each with its short phrase as its
 * detail line and its definition as its hover text; the cached share last ("—" with no reported input).
 */
export function headlineTiles(row) {
  const tiles = [];
  for (const { label, column, format, detail, definition } of HEADLINE_NUMBERS) {
    tiles.push({ label, value: format(row[column]), detail, definition });
  }
  const share = formatOptionalShare(cachedShare(row.cached_tokens, row.reported_input_tokens));
  tiles.push({ label: "Cached share", value: share, detail: CACHED_SHARE_DETAIL, definition: CACHED_SHARE_DEFINITION });
  return tiles;
}

/** Each model's row `{ model, requests, share }`, in the rows' order, its share of every row's requests. */
export function modelShares(rows) {
  let total = 0;
  for (const row of rows) {
    total += row.requests;
  }
  return rows.map((row) => ({ model: row.model, requests: row.requests, share: row.requests / total }));
}

/**
 * The model mix's pills: `{ shown, others }`, `shown` the models of `shares` (as `modelShares` gives them) with at least
 * `MIN_SHARE_WITH_PILL` of the requests, and `others` the rest as one `{ count, requests, share, models }`, null when
 * there is none.
 */
export function modelPills(shares) {
  const shown = shares.filter((model) => model.share >= MIN_SHARE_WITH_PILL);
  const rest = shares.filter((model) => model.share < MIN_SHARE_WITH_PILL);
  if (rest.length === 0) {
    return { shown, others: null };
  }
  let requests = 0;
  let share = 0;
  for (const model of rest) {
    requests += model.requests;
    share += model.share;
  }
  return { shown, others: { count: rest.length, requests, share, models: rest } };
}

async function drawNumbers(place, context) {
  const rows = await context.database.runQuery("explore/headline_numbers");
  place.replaceChildren(statStrip(headlineTiles(rows[0])));
}

async function drawModelMix(place, context) {
  const orderRows = await context.orders.models;
  const rows = await context.database.runQuery("explore/model_mix");
  if (rows.length === 0) {
    showNote(place, "No requests in the selected weeks and harnesses.");
    return;
  }
  const colours = assignColours(orderRows.map((row) => row.model));
  const line = document.createElement("div");
  line.className = "controls model-mix";
  const label = document.createElement("span");
  label.className = "control-label";
  label.textContent = "Model mix, share of requests";
  line.append(label);
  const pills = modelPills(modelShares(rows));
  for (const model of pills.shown) {
    line.append(modelChip(model, colours.get(model.model)));
  }
  if (pills.others !== null) {
    line.append(othersChip(pills.others));
  }
  place.replaceChildren(line);
}

function modelChip(model, colour) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.style.setProperty("--chip-color", colour);
  chip.textContent = `${model.model} · ${formatShare(model.share)}`;
  chip.title = `${formatCount(model.requests)} top-level requests in the selected weeks and harnesses went to ${model.model}.`;
  return chip;
}

// The muted pill of the models under 1%, which lists each of them, with its share, in its hover text.
function othersChip(others) {
  const chip = document.createElement("span");
  chip.className = "chip is-muted";
  chip.textContent = `${others.count} others · ${formatShare(others.share)}`;
  const lines = others.models.map((model) => `${model.model} · ${formatShare(model.share)}`);
  chip.title = `${formatCount(others.requests)} requests:\n${lines.join("\n")}`;
  return chip;
}
