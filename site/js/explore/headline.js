/**
 * The headline numbers of the top-level sessions in the selected weeks and scope, each with its definition
 * on hover, and the model mix: each model's share of their requests, largest first, coloured by the
 * global model order so a model has the same colour on every page.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`.
 */

import { assignColours, showError, showLoading, showNote } from "../shared/charts.js";
import { formatCount, formatOptionalShare, formatShare, formatTokens } from "../shared/format.js";
import { cachedShare } from "./cached_share.js";

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

/** The tiles `{ label, value, definition }` of the headline query's row, the cached share last ("—" with no reported input). */
export function headlineTiles(row) {
  const tiles = [];
  for (const number of HEADLINE_NUMBERS) {
    tiles.push({ label: number.label, value: number.format(row[number.column]), definition: number.definition });
  }
  const share = cachedShare(row.cached_tokens, row.reported_input_tokens);
  tiles.push({ label: "Cached share", value: formatOptionalShare(share), definition: CACHED_SHARE_DEFINITION });
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
  const strip = document.createElement("div");
  strip.className = "stat-strip";
  for (const tile of headlineTiles(rows[0])) {
    strip.append(statTile(tile));
  }
  place.replaceChildren(strip);
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

function statTile(tile) {
  const element = document.createElement("div");
  element.className = "stat";
  element.title = tile.definition;
  element.innerHTML = `
    <div class="stat-label"></div>
    <div class="stat-value"></div>
    <div class="stat-detail"></div>`;
  element.querySelector(".stat-label").textContent = tile.label;
  element.querySelector(".stat-value").textContent = tile.value;
  element.querySelector(".stat-detail").textContent = tile.definition;
  return element;
}

function modelChip(model, colour) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.style.setProperty("--chip-color", colour);
  chip.textContent = `${model.model} · ${formatShare(model.share)}`;
  chip.title = `${formatCount(model.requests)} top-level requests in the selected weeks and scope went to ${model.model}.`;
  return chip;
}
