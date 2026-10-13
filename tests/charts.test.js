import assert from "node:assert/strict";
import { test } from "node:test";

import {
  categoryRowsFrame, chartFrame, chartName, colourScale, columnTotal, dropThinBins, foldToOther, MIN_ROWS_PER_BIN,
  sumFolded,
} from "../site/js/shared/charts.js";
import { assignColours } from "../site/js/theme/colours.js";

const NINE_MODELS = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"];

test("names past the first eight fold into Other, and the rows are not changed in place", () => {
  const rows = [{ model: "m1", requests: 5 }, { model: "m9", requests: 3 }, { model: "unlisted", requests: 1 }];
  const folded = foldToOther(rows, "model", NINE_MODELS);
  assert.deepEqual(folded, [{ model: "m1", requests: 5 }, { model: "Other", requests: 3 }, { model: "Other", requests: 1 }]);
  assert.equal(rows[1].model, "m9");
});

test("folding counts the first eight distinct names, not the first eight entries", () => {
  const names = ["m1", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"];
  const folded = foldToOther([{ model: "m8" }, { model: "m9" }], "model", names);
  assert.deepEqual(folded, [{ model: "m8" }, { model: "Other" }]);
});

test("rows sharing a bar and a series are summed into one, in order of first appearance", () => {
  const rows = [
    { week: "2026-08-02", harness: "m1", sessions: 400 },
    { week: "2026-08-02", harness: "Other", sessions: 30 },
    { week: "2026-08-02", harness: "Other", sessions: 12 },
    { week: "2026-08-09", harness: "Other", sessions: 7 },
    { week: "2026-08-09", harness: "m1", sessions: 380 },
    { week: "2026-08-09", harness: "Other", sessions: 5 },
  ];
  assert.deepEqual(sumFolded(rows, { x: "week", y: "sessions", fill: "harness" }), [
    { week: "2026-08-02", harness: "m1", sessions: 400 },
    { week: "2026-08-02", harness: "Other", sessions: 42 },
    { week: "2026-08-09", harness: "Other", sessions: 12 },
    { week: "2026-08-09", harness: "m1", sessions: 380 },
  ]);
  assert.equal(rows[1].sessions, 30);
});

test("folding then summing leaves one Other row per bar", () => {
  const rows = [{ week: "w1", model: "m8", requests: 3 }, { week: "w1", model: "m9", requests: 4 }, { week: "w1", model: "m10", requests: 5 }];
  const summed = sumFolded(foldToOther(rows, "model", NINE_MODELS), { x: "week", y: "requests", fill: "model" });
  assert.deepEqual(summed, [{ week: "w1", model: "m8", requests: 3 }, { week: "w1", model: "Other", requests: 9 }]);
});

test("a bin with exactly the minimum rows is kept, and one below it is hidden", () => {
  assert.equal(MIN_ROWS_PER_BIN, 50);
  const rows = [{ bin: "a", requests: 50 }, { bin: "b", requests: 49 }, { bin: "c", requests: 1200 }, { bin: "d", requests: 0 }];
  assert.deepEqual(dropThinBins(rows, "requests"), {
    rows: [{ bin: "a", requests: 50 }, { bin: "c", requests: 1200 }],
    hidden: 2,
  });
});

test("counts that DuckDB returns as BigInt are compared like numbers", () => {
  const rows = [{ bin: "a", requests: 50n }, { bin: "b", requests: 49n }];
  assert.deepEqual(dropThinBins(rows, "requests"), { rows: [{ bin: "a", requests: 50n }], hidden: 1 });
});

test("every chart starts from the same frame, as wide as its body", () => {
  const frame = chartFrame({ clientWidth: 300 });
  assert.equal(frame.width, 300);
  assert.equal(frame.height, chartFrame({ clientWidth: 600 }).height);
  assert.equal(chartFrame({ clientWidth: 0 }).width, 480); // a body not yet laid out gets the fallback width
});

test("a colour scale keeps each shown name's colour from the map, in the order shown", () => {
  const colours = assignColours(["m1", "m2", "m3"]);
  assert.deepEqual(colourScale(colours, ["m3", "m1"]), {
    type: "ordinal",
    domain: ["m3", "m1"],
    range: ["var(--series-3)", "var(--series-1)"],
  });
});

test("a chart of category rows is as tall as its rows need, with room for their names and none above them", () => {
  const frame = categoryRowsFrame({ clientWidth: 600 }, 15);
  assert.equal(frame.width, 600);
  assert.equal(frame.height, 15 * 22 + 56);
  assert.equal(frame.marginTop, 8);
  assert.equal(frame.marginLeft, 116);
});

test("a chart's margins hold its 14.6 px tick labels and axis titles", () => {
  const frame = chartFrame({ clientWidth: 600 });
  assert.equal(frame.marginLeft, 72); // a count of six digits with its separator, as "150,000"
  assert.equal(frame.marginBottom, 48); // the x tick labels, and the axis title on a line below them
  assert.equal(frame.marginTop, 32); // the y axis title above the chart
});

test("a column's total sums it over the rows, and is 0 for no rows", () => {
  assert.equal(columnTotal([{ sessions: 3 }, { sessions: 4 }], "sessions"), 7);
  assert.equal(columnTotal([], "sessions"), 0);
});

/** A figure's body as `renderFigure` lays it out, its card holding the elements `parts` names by class. */
function bodyOfFigure(parts) {
  const figure = { querySelector: (selector) => parts[selector] ?? null };
  return { closest: () => figure };
}

test("a chart is named by its card's title and insight, or its caption where the card has no insight", () => {
  const title = { textContent: "Tokens per request" };
  const insight = { textContent: "Each request adds little to a large context." };
  const caption = { textContent: "Input, uncached input and output tokens of each request." };
  const withInsight = bodyOfFigure({ ".figure-title": title, ".figure-insight": insight, ".figure-caption": caption });
  assert.equal(chartName(withInsight), "Tokens per request: Each request adds little to a large context.");
  const withCaption = bodyOfFigure({ ".figure-title": title, ".figure-caption": caption });
  assert.equal(chartName(withCaption), "Tokens per request: Input, uncached input and output tokens of each request.");
});
