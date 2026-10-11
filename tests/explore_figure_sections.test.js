import assert from "node:assert/strict";
import { test } from "node:test";

import {
  drawFigureSeries, figureColours, figuresToStart, newFigureRun, noteVisibility,
} from "../site/js/explore/figure_sections.js";
import { SERIES_SLOTS } from "../site/js/shared/charts.js";

test("the figures' colours follow the model, category and provider orders, each from the first series colour", async () => {
  const orders = {
    models: Promise.resolve([{ model: "model-b" }, { model: "model-a" }]),
    categories: Promise.resolve([{ category: "Read" }, { category: "Edit" }]),
    providers: Promise.resolve([{ provider: "B" }, { provider: "A" }]),
  };
  const colours = await figureColours(orders);
  assert.deepEqual([...colours.models], [["model-b", SERIES_SLOTS[0]], ["model-a", SERIES_SLOTS[1]]]);
  assert.deepEqual([...colours.categories], [["Read", SERIES_SLOTS[0]], ["Edit", SERIES_SLOTS[1]]]);
  assert.deepEqual([...colours.providers], [["B", SERIES_SLOTS[0]], ["A", SERIES_SLOTS[1]]]);
  assert.ok(Object.isFrozen(colours));
});

// Three figures in page order, as `figuresToStart` takes them, and a run's context it only carries.
const FIGURE_LIST = [{ name: "first" }, { name: "second" }, { name: "third" }];
const CONTEXT = { selection: { weeks: ["2026-07-05"], harnesses: ["hermes"] } };

function names(figureList) {
  return figureList.map((figure) => figure.name);
}

test("a new run carries its context and has started no figure", () => {
  const run = newFigureRun(CONTEXT, false);
  assert.equal(run.context, CONTEXT);
  assert.equal(run.drawsAtOnce, false);
  assert.equal(run.startedNames.size, 0);
});

test("a run that draws at once starts every figure, whether in view or not", () => {
  const run = newFigureRun(CONTEXT, true);
  assert.deepEqual(names(figuresToStart(run, FIGURE_LIST, new Set())), ["first", "second", "third"]);
});

test("a run that draws in view starts only the figures in view, in page order", () => {
  const run = newFigureRun(CONTEXT, false);
  assert.deepEqual(names(figuresToStart(run, FIGURE_LIST, new Set(["third", "first"]))), ["first", "third"]);
  assert.deepEqual(figuresToStart(run, FIGURE_LIST, new Set()), []);
});

test("a figure already started for the run is not started again when it comes back into view", () => {
  const run = newFigureRun(CONTEXT, false);
  run.startedNames.add("first");
  assert.deepEqual(names(figuresToStart(run, FIGURE_LIST, new Set(["first", "second"]))), ["second"]);
});

test("a new run, as a selection change makes, starts the figures in view again", () => {
  const visible = new Set(["first"]);
  const earlier = newFigureRun(CONTEXT, false);
  earlier.startedNames.add("first");
  assert.deepEqual(figuresToStart(earlier, FIGURE_LIST, visible), []);
  assert.deepEqual(names(figuresToStart(newFigureRun(CONTEXT, false), FIGURE_LIST, visible)), ["first"]);
});

test("intersection entries add the cards in view and remove the cards that left it", () => {
  const visible = new Set(["first", "second"]);
  noteVisibility(visible, [
    { target: { id: "second" }, isIntersecting: false },
    { target: { id: "third" }, isIntersecting: true },
  ]);
  assert.deepEqual([...visible].sort(), ["first", "third"]);
});

// Rows of two series, as a long-format figure's query returns them.
const SERIES_ROWS = [{ series: "a", x: 1 }, { series: "b", x: 2 }, { series: "a", x: 3 }];

/** A figure entry that keeps the arguments it is drawn with; `seriesColumn` is left out when undefined. */
function recordingFigure(seriesColumn) {
  const calls = [];
  const figure = { draw: (...args) => calls.push(args) };
  if (seriesColumn !== undefined) {
    figure.seriesColumn = seriesColumn;
  }
  return { figure, calls };
}

test("a long-format figure is drawn from the rows of its shown series, without the hidden set", async () => {
  const { figure, calls } = recordingFigure("series");
  await drawFigureSeries(figure, SERIES_ROWS, "body", "colours", new Set(["b"]));
  assert.deepEqual(calls, [[[{ series: "a", x: 1 }, { series: "a", x: 3 }], "body", "colours"]]);
});

test("a wide-format figure is drawn from every row and given the hidden set", async () => {
  const { figure, calls } = recordingFigure(undefined);
  const hidden = new Set(["cached"]);
  await drawFigureSeries(figure, SERIES_ROWS, "body", "colours", hidden);
  assert.deepEqual(calls, [[SERIES_ROWS, "body", "colours", hidden]]);
});
