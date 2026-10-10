/**
 * The headline numbers of the top-level sessions in the selected weeks and scope, each with its definition
 * on hover, and the model mix: each model's share of their requests, largest first, coloured by the
 * global model order so a model has the same colour on every page.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`.
 */

import { assignColours, showError, showLoading, showNote } from "../shared/charts.js";
import { cachedShare, formatCount, formatOptionalShare, formatShare, formatTokens } from "../shared/format.js";
import { statStrip } from "../shared/tiles.js";

// Each headline number read straight from the query's one row: its label, column, format and definition.
const HEADLINE_NUMBERS = Object.freeze([
  Object.freeze({ label: "Sessions", column: "sessions", format: formatCount,
    definition: "Top-level sessions: those no other session spawned." }),
  Object.freeze({ label: "Accounts", column: "accounts", format: formatCount,
    definition: "Distinct accounts (user ids) that ran them." }),
  Object.freeze({ label: "Requests", column: "requests", format: formatCount,
    definition: "LLM requests of the top-level sessions." }),
  Object.freeze({ label: "Input tokens", column: "input_tokens", format: formatTokens,
    definition: "Prompt tokens of those requests." }),
  Object.freeze({ label: "Output tokens", column: "output_tokens", format: formatTokens,
    definition: "Completion tokens of those requests." }),
  Object.freeze({ label: "Tool calls", column: "tool_calls", format: formatCount,
    definition: "Tool calls their responses made." }),
  Object.freeze({ label: "Subagents", column: "subagents", format: formatCount,
    definition: "Subagent sessions they spawned, at any depth." }),
]);

// The definition of the cached share, the one headline number computed from two columns.
const CACHED_SHARE_DEFINITION = "Cached tokens over the input of the requests whose provider reports cache reads.";

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
 * The tiles `{ label, value, detail, definition }` of the headline query's row, each tile's definition also its
 * detail line; the cached share last ("—" with no reported input).
 */
export function headlineTiles(row) {
  const tiles = [];
  for (const number of HEADLINE_NUMBERS) {
    tiles.push(headlineTile(number.label, number.format(row[number.column]), number.definition));
  }
  const share = cachedShare(row.cached_tokens, row.reported_input_tokens);
  tiles.push(headlineTile("Cached share", formatOptionalShare(share), CACHED_SHARE_DEFINITION));
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

async function drawNumbers(place, context) {
  const rows = await context.database.runQuery("explore/headline_numbers");
  place.replaceChildren(statStrip(headlineTiles(rows[0])));
}

async function drawModelMix(place, context) {
  const orderRows = await context.orders.models;
  const rows = await context.database.runQuery("explore/model_mix");
  if (rows.length === 0) {
    showNote(place, "No requests in the selected weeks and scope.");
    return;
  }
  const colours = assignColours(orderRows.map((row) => row.model));
  const line = document.createElement("div");
  line.className = "controls";
  const label = document.createElement("span");
  label.className = "control-label";
  label.textContent = "Model mix, share of requests";
  line.append(label);
  for (const model of modelShares(rows)) {
    line.append(modelChip(model, colours.get(model.model)));
  }
  place.replaceChildren(line);
}

function headlineTile(label, value, definition) {
  return { label, value, detail: definition, definition };
}

function modelChip(model, colour) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.style.setProperty("--chip-color", colour);
  chip.textContent = `${model.model} · ${formatShare(model.share)}`;
  chip.title = `${formatCount(model.requests)} top-level requests in the selected weeks and scope went to ${model.model}.`;
  return chip;
}
