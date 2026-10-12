/**
 * The ticks of a chart's axes: how many a linear axis asks for, where a log axis of counts or of seconds ticks, which
 * ticks of a week axis or a crowded band axis carry a label, and an axis mark that labels each tick it is given. These
 * are plain functions, tested with `node --test`; the drawing modules give what they return to Plot.
 */

import { shortMonth } from "../shared/format.js";

// The characters of a week's Sunday that name its month: "YYYY-MM".
const MONTH_LENGTH = "YYYY-MM".length;

/** The most ticks an axis labels: at the smallest type size, more would run into one another on a phone. */
export const MAX_TICKS = 6;
/**
 * The tick count a linear axis asks Plot for: Plot rounds a count to steps of 1, 2 or 5, which gives up to about
 * twice as many ticks, so asking for four gives at most `MAX_TICKS` or seven.
 */
export const TICK_COUNT = 4;
// The durations a log axis of seconds ticks at, as people count time: a tenth of a second, a second, a minute, an hour,
// a day and a week. Not ten seconds nor a hundredth: "10 s" and "1 min", or "0.01 s" and "0.1 s", are too close to
// share a phone's axis.
const DURATION_TICKS_S = Object.freeze([0.1, 1, 60, 3600, 86400, 604800]);

/**
 * The ticks of a log axis over `[low, high]`: its powers of ten, every second, third or more of them when there are
 * more than `maxTicks`, so the labels never crowd; Plot's own ticks when the range holds fewer than two powers.
 */
export function logAxisTicks([low, high], maxTicks = MAX_TICKS) {
  const powers = decadeTicks([low, high]);
  if (powers.length < 2) {
    return undefined;
  }
  const step = Math.ceil(powers.length / maxTicks);
  return powers.filter((power, index) => index % step === 0);
}

/**
 * The ticks of a log axis of seconds over `[low, high]`: the durations of `DURATION_TICKS_S` within it, every second one
 * when there are more than `MAX_TICKS`.
 */
export function durationTicks([low, high]) {
  const ticks = DURATION_TICKS_S.filter((seconds) => seconds >= low && seconds <= high);
  if (ticks.length <= MAX_TICKS) {
    return ticks;
  }
  return ticks.filter((seconds, index) => index % 2 === 0);
}

/** The `[low, high]` of a log axis over `values`: the power of ten at or below the smallest, and at or above the largest. */
export function decadeDomain(values) {
  const [low, high] = extent(values);
  return [10 ** Math.floor(Math.log10(low)), 10 ** Math.ceil(Math.log10(high))];
}

/** The powers of ten from `low` to `high`, both included where they are powers of ten. */
export function decadeTicks([low, high]) {
  const ticks = [];
  for (let exponent = Math.ceil(Math.log10(low)); 10 ** exponent <= high; exponent += 1) {
    ticks.push(10 ** exponent);
  }
  return ticks;
}

/**
 * An axis mark made by `makeAxis` (`Plot.axisX` or `Plot.axisY`) with `options`, labelling each of `ticks` when given,
 * else the ticks Plot chooses, each written by `options.tickFormat` when it has one.
 */
export function axisWithTicks(makeAxis, ticks, { tickFormat, ...options }) {
  if (ticks === undefined) {
    return makeAxis({ ...options, tickFormat });
  }
  if (tickFormat === undefined) {
    return makeAxis(ticks, options);
  }
  // Written as the mark's text, every tick is labelled; as its tick format, a log axis blanks a tick such as 60 that
  // is not 1, 2 or 5 times a power of ten.
  return makeAxis(ticks, { ...options, text: (tick) => tickFormat(tick) });
}

/** The smallest and largest of `values`, a list of positive numbers: `[low, high]`. */
export function extent(values) {
  return [Math.min(...values), Math.max(...values)];
}

/**
 * A tick format for a crowded band axis: `format(value)` for every `step`-th of `values` (in axis order, first
 * included), the step chosen so at most `maxLabels` are written, and "" for the rest.
 */
export function sparseTickFormat(values, format, maxLabels) {
  const step = Math.max(1, Math.ceil(values.length / maxLabels));
  const labelled = new Set(values.filter((value, index) => index % step === 0));
  return (value) => (labelled.has(value) ? format(value) : "");
}

/** The weeks (Sundays, in order) whose tick a week axis labels: the first of each month, so ticks never crowd. */
export function firstWeekOfEachMonth(weeks) {
  const labelled = [];
  for (let index = 0; index < weeks.length; index += 1) {
    const month = weeks[index].slice(0, MONTH_LENGTH);
    if (index === 0 || weeks[index - 1].slice(0, MONTH_LENGTH) !== month) {
      labelled.push(weeks[index]);
    }
  }
  return labelled;
}

/**
 * A week axis's tick format: the first week of each month of `weeks` (Sundays) as its month, "May", the others
 * unlabelled; a month's name is short enough for sixteen weeks on a phone, where "May 17" and "Jun 7" would touch.
 */
export function weekTickFormat(weeks) {
  const labelled = firstWeekOfEachMonth(weeks);
  return (week) => (labelled.includes(week) ? shortMonth(week) : "");
}
