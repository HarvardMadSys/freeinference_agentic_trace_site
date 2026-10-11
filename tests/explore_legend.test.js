import assert from "node:assert/strict";
import { test } from "node:test";

import {
  drawWithLegend, hasLegend, isEverySeriesHidden, mountLegend, shownRows, toggledSeries,
} from "../site/js/explore/legend.js";

/** A stand-in for a page element: children, attributes, listeners and the place before it, as the legend uses them. */
class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.className = "";
    this.textContent = "";
    this.placedBefore = [];
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  before(element) {
    this.placedBefore.push(element);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get("click")();
  }

  /** The text of the element's own string children, as a button's label is. */
  label() {
    return this.children.filter((child) => typeof child === "string").join("");
  }
}

/** Make a stand-in the global document for the test of `context`; node has none of its own. */
function useFakeDocument(context) {
  globalThis.document = { createElement: (tag) => new FakeElement(tag) };
  context.after(() => delete globalThis.document);
}

/** Let the clicks' redraws, which run after the click returns, settle. */
function settle() {
  return new Promise((resolve) => setImmediate(resolve));
}

// A legend of two series, as a figure's `legend` function returns one.
const LEGEND = {
  series: [{ name: "hermes", label: "hermes" }, { name: "pi", label: "Pi" }],
  colours: new Map([["hermes", "var(--series-1)"], ["pi", "var(--series-2)"]]),
};

test("toggling a series hides it when shown and shows it when hidden, leaving the set it was given alone", () => {
  const hidden = new Set(["pi"]);
  assert.deepEqual([...toggledSeries(hidden, "hermes")].sort(), ["hermes", "pi"]);
  assert.deepEqual([...toggledSeries(hidden, "pi")], []);
  assert.deepEqual([...hidden], ["pi"]);
});

test("a long-format figure keeps the rows of the series not hidden, in their order", () => {
  const rows = [{ model: "a", x: 1 }, { model: "b", x: 2 }, { model: "a", x: 3 }];
  assert.deepEqual(shownRows(rows, "model", new Set(["b"])), [{ model: "a", x: 1 }, { model: "a", x: 3 }]);
  assert.deepEqual(shownRows(rows, "model", new Set()), rows);
});

test("every series is hidden only when each of the legend's series is", () => {
  assert.equal(isEverySeriesHidden(LEGEND.series, new Set(["hermes"])), false);
  assert.equal(isEverySeriesHidden(LEGEND.series, new Set(["hermes", "pi"])), true);
});

test("a legend of no series has no series hidden, so its chart is never replaced by the note", () => {
  assert.equal(isEverySeriesHidden([], new Set()), false);
});

test("a legend lists two series or more", () => {
  assert.equal(hasLegend([]), false);
  assert.equal(hasLegend(LEGEND.series.slice(0, 1)), false);
  assert.equal(hasLegend(LEGEND.series), true);
});

test("a legend of one series mounts no button", (context) => {
  useFakeDocument(context);
  const container = new FakeElement("div");
  container.append(new FakeElement("button")); // a button of an earlier legend, which the mount clears
  mountLegend(container, LEGEND.series.slice(0, 1), LEGEND.colours, new Set(), () => undefined);
  assert.deepEqual(container.children, []);
});

test("the legend is one button per series, labelled and coloured, pressed unless hidden", (context) => {
  useFakeDocument(context);
  const container = new FakeElement("div");
  mountLegend(container, LEGEND.series, LEGEND.colours, new Set(["pi"]), () => undefined);
  const buttons = container.children;
  assert.deepEqual(buttons.map((button) => button.tag), ["button", "button"]);
  assert.deepEqual(buttons.map((button) => button.label()), ["hermes", "Pi"]);
  assert.deepEqual(buttons.map((button) => button.children[0].style.background), ["var(--series-1)", "var(--series-2)"]);
  assert.deepEqual(buttons.map((button) => button.getAttribute("aria-pressed")), ["true", "false"]);
});

test("a click on a legend button names its series and flips the button", (context) => {
  useFakeDocument(context);
  const container = new FakeElement("div");
  const toggled = [];
  mountLegend(container, LEGEND.series, LEGEND.colours, new Set(), (name) => toggled.push(name));
  container.children[1].click();
  assert.deepEqual(toggled, ["pi"]);
  assert.equal(container.children[1].getAttribute("aria-pressed"), "false");
  container.children[1].click();
  assert.equal(container.children[1].getAttribute("aria-pressed"), "true");
});

test("a chart with a legend is drawn with nothing hidden, then again with each click's series hidden or shown", async (context) => {
  useFakeDocument(context);
  const body = new FakeElement("div");
  const drawnWith = [];
  await drawWithLegend(body, LEGEND, (hidden) => drawnWith.push([...hidden]));
  const [legendPlace] = body.placedBefore;
  legendPlace.children[0].click();
  await settle();
  legendPlace.children[0].click();
  await settle();
  assert.deepEqual(drawnWith, [[], ["hermes"], []]);
});

test("a chart whose every series is hidden shows a note instead of being drawn", async (context) => {
  useFakeDocument(context);
  const body = new FakeElement("div");
  let draws = 0;
  await drawWithLegend(body, LEGEND, () => { draws += 1; });
  const [legendPlace] = body.placedBefore;
  legendPlace.children[0].click();
  legendPlace.children[1].click();
  await settle();
  assert.equal(draws, 2); // the first drawing and the one with hermes hidden
  assert.equal(body.children[0].className, "note");
});

test("a new drawing, as a new selection makes, starts with every series shown", async (context) => {
  useFakeDocument(context);
  const earlierBody = new FakeElement("div");
  await drawWithLegend(earlierBody, LEGEND, () => undefined);
  earlierBody.placedBefore[0].children[0].click();
  await settle();
  const drawnWith = [];
  const body = new FakeElement("div");
  await drawWithLegend(body, LEGEND, (hidden) => drawnWith.push([...hidden]));
  assert.deepEqual(drawnWith, [[]]);
  assert.deepEqual(body.placedBefore[0].children.map((button) => button.getAttribute("aria-pressed")), ["true", "true"]);
});

test("a chart of one series or none is drawn once with nothing hidden, with no legend placed and no note", async (context) => {
  useFakeDocument(context);
  for (const series of [[], LEGEND.series.slice(0, 1)]) {
    const body = new FakeElement("div");
    const drawnWith = [];
    await drawWithLegend(body, { series, colours: LEGEND.colours }, (hidden) => drawnWith.push([...hidden]));
    assert.deepEqual(drawnWith, [[]]);
    assert.deepEqual(body.placedBefore, []);
    assert.deepEqual(body.children, []);
  }
});

test("a drawing after a click that fails shows its error in the chart's place", async (context) => {
  useFakeDocument(context);
  context.mock.method(console, "error", () => undefined); // the error is logged as well as shown; keep the run quiet
  const body = new FakeElement("div");
  let draws = 0;
  async function drawChart() {
    draws += 1;
    if (draws > 1) {
      throw new Error("the chart could not be drawn");
    }
  }
  await drawWithLegend(body, LEGEND, drawChart);
  body.placedBefore[0].children[0].click();
  await settle();
  assert.equal(body.children[0].className, "note is-error");
  assert.equal(body.children[0].textContent, "the chart could not be drawn");
});
