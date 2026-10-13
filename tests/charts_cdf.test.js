import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cdfLegend, cdfPoints, cdfSeries, cdfTipText, drawnTicks, seriesMedians,
} from "../site/js/charts/cdf.js";
import { formatCount, formatSeconds } from "../site/js/shared/format.js";

// Two CDF series of two points each, as a CDF query gives them: `requests` over 120 sessions, `tool_steps` over 30.
const CDF_ROWS = [
  { series: "requests", x: 3, share: 0, rows: 120 },
  { series: "requests", x: 40, share: 1, rows: 120 },
  { series: "tool_steps", x: 0, share: 0, rows: 30 },
  { series: "tool_steps", x: 12, share: 1, rows: 30 },
];

// Two points of each scope of a scope CDF, each scope's median on its rows: the human-driven one under a floor of 1.
const MEDIAN_ROWS = [
  { series: "Agentic", x: 0.2, share: 0, median: 0.5 },
  { series: "Agentic", x: 3000, share: 1, median: 0.5 },
  { series: "SWE-Bench", x: 20, share: 0, median: 188.3 },
  { series: "SWE-Bench", x: 900, share: 1, median: 188.3 },
];

test("the rows become series in the order of the names given, a series with no rows left out", () => {
  assert.deepEqual(cdfSeries(CDF_ROWS, ["tool_steps", "user_steps", "requests"]), [
    { name: "tool_steps", label: "tool_steps", points: [{ x: 0, share: 0 }, { x: 12, share: 1 }] },
    { name: "requests", label: "requests", points: [{ x: 3, share: 0 }, { x: 40, share: 1 }] },
  ]);
});

test("a series keeps its name and is labelled by its label where it has one", () => {
  const series = cdfSeries(CDF_ROWS, ["requests", "tool_steps"], { labels: { tool_steps: "Tool steps" } });
  assert.deepEqual(series.map((one) => one.name), ["requests", "tool_steps"]);
  assert.deepEqual(series.map((one) => one.label), ["requests", "Tool steps"]);
});

test("a value below the floor is drawn at the floor", () => {
  const [toolSteps] = cdfSeries(CDF_ROWS, ["tool_steps"], { floor: 1 });
  assert.deepEqual(toolSteps.points, [{ x: 1, share: 0 }, { x: 12, share: 1 }]);
});

test("the points of every series form one list, each naming its series and label", () => {
  const points = cdfPoints(cdfSeries(CDF_ROWS, ["requests", "tool_steps"], { labels: { tool_steps: "Tool steps" } }));
  assert.equal(points.length, 4);
  assert.deepEqual(points[2], { name: "tool_steps", label: "Tool steps", x: 0, share: 0 });
});

test("the medians are each series' own, smallest first, each drawn no lower than the floor", () => {
  const series = cdfSeries(MEDIAN_ROWS, ["Agentic", "SWE-Bench"]);
  assert.deepEqual(seriesMedians(MEDIAN_ROWS, series, "median", 1), [
    { series: "Agentic", median: 0.5, x: 1 },
    { series: "SWE-Bench", median: 188.3, x: 188.3 },
  ]);
  const reversed = MEDIAN_ROWS.map((row) => ({ ...row, median: row.series === "SWE-Bench" ? 0.1 : row.median }));
  assert.deepEqual(seriesMedians(reversed, series, "median", 1).map((median) => median.series), ["SWE-Bench", "Agentic"]);
});

test("a CDF without a median column marks no median on its lines", () => {
  assert.deepEqual(seriesMedians(CDF_ROWS, cdfSeries(CDF_ROWS, ["requests"]), undefined), []);
});

test("the tooltip names the series, its value, and the share at or below it, or of what the CDF counts", () => {
  const point = { name: "turn", label: "Turn", x: 90, share: 0.5 };
  assert.equal(cdfTipText(point, formatSeconds), "Turn\n1.5 min\n50.0% at or below");
  assert.equal(cdfTipText(point, formatSeconds, "turns"), "Turn\n1.5 min\n50.0% of turns");
  assert.equal(cdfTipText({ ...point, x: 1234 }, formatCount), "Turn\n1,234\n50.0% at or below");
});

test("a log axis ticks its powers of ten over its values, or over its domain, unless the figure gives its ticks", () => {
  const points = [{ x: 1 }, { x: 5000 }];
  assert.deepEqual(drawnTicks({ logScale: true }, points, 600), [1, 10, 100, 1000]);
  assert.deepEqual(drawnTicks({ logScale: true, xDomain: [1, 100] }, points, 600), [1, 10, 100]);
  assert.deepEqual(drawnTicks({ logScale: true, xTicks: [1, 60] }, points, 600), [1, 60]);
  assert.equal(drawnTicks({ logScale: false }, points, 600), undefined);
});

test("a narrow chart takes its narrow ticks where the figure gives them, else its ticks", () => {
  const parameters = { logScale: true, xTicks: [1, 10, 100, 1e3, 1e4, 1e5], narrowXTicks: [1, 100, 1e4] };
  assert.deepEqual(drawnTicks(parameters, [], 300), [1, 100, 1e4]);
  assert.deepEqual(drawnTicks(parameters, [], 600), parameters.xTicks);
  assert.deepEqual(drawnTicks({ logScale: true, xTicks: [1, 60] }, [], 300), [1, 60]);
});

test("the legend lists the series the rows hold, in the colours' order, each labelled where it has a label", () => {
  const colours = new Map([["requests", "red"], ["user_steps", "blue"], ["tool_steps", "green"]]);
  const legend = cdfLegend(CDF_ROWS, colours, { labels: { tool_steps: "Tool steps" } });
  assert.deepEqual(legend.series, [{ name: "requests", label: "requests" }, { name: "tool_steps", label: "Tool steps" }]);
  assert.equal(legend.colours, colours);
  assert.deepEqual(cdfLegend(CDF_ROWS.slice(2), colours).series, [{ name: "tool_steps", label: "tool_steps" }]);
});
