import assert from "node:assert/strict";
import { test } from "node:test";

import {
  drawFigureSeries, figuresToStart, newFigureRun, noteVisibility, runDrawsAtOnce, startFigures,
} from "../site/js/explore/figure_sections.js";

// Three figures in page order, as `figuresToStart` takes them, and a run's context it only carries.
const FIGURE_LIST = [{ name: "first" }, { name: "second" }, { name: "third" }];
const CONTEXT = { selection: { weeks: ["2026-07-05"], harnesses: ["hermes"] } };

function names(figureList) {
  return figureList.map((figure) => figure.name);
}

// The weeks and harnesses of `CONTEXT`'s page: its selection is narrowed to one week.
const PAGE = {
  weeks: [{ week: "2026-06-28" }, { week: "2026-07-05" }],
  harnesses: [{ harness: "hermes", benchmark: false }, { harness: "eval:swe-bench", benchmark: true }],
};

test("a page that draws every run at once draws a narrowed selection's run at once", () => {
  assert.equal(runDrawsAtOnce(true, { ...PAGE, ...CONTEXT }), true);
});

test("a page that draws in view draws a narrowed selection in view, and the default selection at once", () => {
  assert.equal(runDrawsAtOnce(false, { ...PAGE, ...CONTEXT }), false);
  const everyWeek = { weeks: ["2026-06-28", "2026-07-05"], harnesses: ["hermes"] };
  assert.equal(runDrawsAtOnce(false, { ...PAGE, selection: everyWeek }), true);
});

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

/**
 * What the page keeps of two figures, "first" in a shown topic and "second" in a hidden one, for a run that draws at
 * once, its queries answered by `answer`; and the two topics, whose `hidden` a test flips as the tabs do.
 */
function figuresOfTwoTopics(answer) {
  const shownTopic = { hidden: false };
  const hiddenTopic = { hidden: true };
  const cards = [{ figure: { name: "first" }, topic: shownTopic }, { figure: { name: "second" }, topic: hiddenTopic }];
  const places = new Map();
  for (const { figure, topic } of cards) {
    places.set(figure.name, { body: { replaceChildren: () => undefined }, rows: {}, topic });
  }
  const orders = { models: Promise.resolve([]), categories: Promise.resolve([]), providers: Promise.resolve([]) };
  const context = { orders, database: { runQuery: answer }, selection: { weeks: [] }, weeks: [] };
  const run = newFigureRun(context, true);
  return { figures: { cards, places, run, visibleNames: new Set() }, shownTopic, hiddenTopic };
}

// An answer that never comes, so a started figure stays drawing and touches no page.
const NEVER_ANSWERED = () => new Promise(() => undefined);

test("a run that draws at once starts the shown topic's figures alone, and a hidden topic's once it is shown", () => {
  const { figures, shownTopic, hiddenTopic } = figuresOfTwoTopics(NEVER_ANSWERED);
  startFigures(figures);
  assert.deepEqual([...figures.run.startedNames], ["first"]);
  hiddenTopic.hidden = false;
  shownTopic.hidden = true;
  startFigures(figures);
  assert.deepEqual([...figures.run.startedNames], ["first", "second"]);
});

test("a topic shown twice in one run does not start its figures twice", () => {
  const { figures } = figuresOfTwoTopics(NEVER_ANSWERED);
  assert.equal(startFigures(figures).length, 1);
  assert.equal(startFigures(figures).length, 0);
});

test("a figure whose topic was hidden before its drawing settled is started again when the topic is next shown", async () => {
  globalThis.document = { createElement: () => ({}) };
  const { figures, shownTopic } = figuresOfTwoTopics(() => Promise.resolve([]));
  const drawings = startFigures(figures);
  shownTopic.hidden = true;
  await Promise.all(drawings);
  assert.deepEqual([...figures.run.startedNames], []);
  shownTopic.hidden = false;
  const drawnAgain = startFigures(figures);
  assert.equal(drawnAgain.length, 1);
  await Promise.all(drawnAgain);
  assert.deepEqual([...figures.run.startedNames], ["first"]);
  delete globalThis.document;
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

// A figure's body as the drawing names its chart in it: here the figure draws no chart, so there is none to name.
const BODY = Object.freeze({ querySelectorAll: () => [] });

test("a long-format figure is drawn from the rows of its shown series, without the hidden set", async () => {
  const { figure, calls } = recordingFigure("series");
  await drawFigureSeries(figure, SERIES_ROWS, BODY, "colours", new Set(["b"]));
  assert.deepEqual(calls, [[[{ series: "a", x: 1 }, { series: "a", x: 3 }], BODY, "colours"]]);
});

test("a wide-format figure is drawn from every row and given the hidden set", async () => {
  const { figure, calls } = recordingFigure(undefined);
  const hidden = new Set(["cached"]);
  await drawFigureSeries(figure, SERIES_ROWS, BODY, "colours", hidden);
  assert.deepEqual(calls, [[SERIES_ROWS, BODY, "colours", hidden]]);
});
