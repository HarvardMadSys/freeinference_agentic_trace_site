import assert from "node:assert/strict";
import { test } from "node:test";

import { drawFigureSeries, newFigureRun, startFigures } from "../site/js/explore/figure_sections.js";

test("a new run carries its context and has started no figure", () => {
  const context = { weeks: [] };
  const run = newFigureRun(context);
  assert.equal(run.context, context);
  assert.equal(run.startedNames.size, 0);
});

/**
 * What the page keeps of two figures, "first" in a shown topic and "second" in a hidden one, for a run; and the two
 * topics, whose `hidden` a test flips as the tabs do.
 */
function figuresOfTwoTopics() {
  const shownTopic = { hidden: false };
  const hiddenTopic = { hidden: true };
  const cards = [{ figure: { name: "first" }, topic: shownTopic }, { figure: { name: "second" }, topic: hiddenTopic }];
  const places = new Map();
  for (const { figure, topic } of cards) {
    places.set(figure.name, { body: { replaceChildren: () => undefined }, rows: {}, topic });
  }
  const orders = { models: Promise.resolve([]), categories: Promise.resolve([]), providers: Promise.resolve([]) };
  const run = newFigureRun({ orders, weeks: [] });
  return { figures: { cards, places, run }, shownTopic, hiddenTopic };
}

// A stand-in for the page's `fetch` whose answer never comes, so a started figure stays drawing and touches no page.
const NEVER_ANSWERED = () => new Promise(() => undefined);

// A stand-in for the page's `fetch` that answers every file with no rows.
const ANSWERED_EMPTY = async () => ({ ok: true, json: async () => [] });

test("a run starts the shown topic's figures alone, and a hidden topic's once it is shown", (context) => {
  context.mock.method(globalThis, "fetch", NEVER_ANSWERED);
  const { figures, shownTopic, hiddenTopic } = figuresOfTwoTopics();
  startFigures(figures);
  assert.deepEqual([...figures.run.startedNames], ["first"]);
  hiddenTopic.hidden = false;
  shownTopic.hidden = true;
  startFigures(figures);
  assert.deepEqual([...figures.run.startedNames], ["first", "second"]);
});

test("a topic shown twice does not start its figures twice", (context) => {
  context.mock.method(globalThis, "fetch", NEVER_ANSWERED);
  const { figures } = figuresOfTwoTopics();
  assert.equal(startFigures(figures).length, 1);
  assert.equal(startFigures(figures).length, 0);
});

test("a figure whose topic was hidden before its drawing settled is started again when it is next shown", async (context) => {
  context.mock.method(globalThis, "fetch", ANSWERED_EMPTY);
  globalThis.document = { createElement: () => ({}) };
  const { figures, shownTopic } = figuresOfTwoTopics();
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
