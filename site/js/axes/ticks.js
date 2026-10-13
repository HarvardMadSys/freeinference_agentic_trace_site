/**
 * The ticks of a chart's axes: how many a linear axis asks for, where a log axis of counts or of seconds ticks and how
 * many fewer a narrow chart takes, which ticks of a week axis or a crowded band axis carry a label, how a percentage
 * axis writes its ticks, an elapsed-time axis, and an axis mark that labels each tick it is given. These are plain
 * functions, tested with `node --test`; the drawing modules give what they return to Plot.
 */

import { elapsedTickFormat, formatElapsed, shortMonth } from "../shared/format.js";

// The characters of a week's Sunday that name its month: "YYYY-MM".
const MONTH_LENGTH = "YYYY-MM".length;

/** The most ticks an axis labels: at the smallest type size, more would run into one another on a phone. */
export const MAX_TICKS = 6;
/** The most ticks a narrow chart's axis labels, so its labels keep a gap between them. */
export const NARROW_MAX_TICKS = 3;
// A chart narrower than this, in pixels, is narrow: a phone's, or a third of a desktop page.
const NARROW_CHART_WIDTH = 480;
// A week axis labels a month's first week only when the next labelled week is at least this many weeks later, so a
// month the data begin late in, such as May 17 before June 7, does not crowd the next.
const MIN_WEEKS_BETWEEN_LABELS = 4;
const DAYS_PER_WEEK = 7;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_DAY = 86400000;
/**
 * The tick count a linear axis asks Plot for: Plot rounds a count to steps of 1, 2 or 5, which gives up to about
 * twice as many ticks, so asking for four gives at most `MAX_TICKS` or seven.
 */
export const TICK_COUNT = 4;
// The durations a log axis of seconds ticks at, as people count time: a tenth of a second, a second, a minute, an hour,
// a day and a week. Not ten seconds nor a hundredth: "10 s" and "1 min", or "0.01 s" and "0.1 s", are too close to
// share a phone's axis.
const DURATION_TICKS_S = Object.freeze([0.1, 1, 60, 3600, 86400, 604800]);
// The pixels an x axis gives each tick label, such as "12:30".
const TICK_SPACING_PX = 90;

// The steps an elapsed-time axis ticks by, in seconds: round seconds, minutes, hours and days.
const TICK_STEPS_S = Object.freeze([
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800,
]);

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

/** The ticks of a log axis of seconds over `[low, high]`: the durations of `DURATION_TICKS_S` within it. */
export function durationTicks([low, high]) {
  return DURATION_TICKS_S.filter((seconds) => seconds >= low && seconds <= high);
}

/** `ticks`, or every other one of them when there are more than `maxTicks`. */
export function atMost(ticks, maxTicks) {
  return ticks.length <= maxTicks ? ticks : everyOther(ticks);
}

/**
 * The ticks an axis of a chart `width` pixels wide asks for or labels at most: `count`, or `NARROW_MAX_TICKS` on a
 * narrow chart.
 */
export function tickCountFor(width, count) {
  return isNarrowChart(width) ? NARROW_MAX_TICKS : count;
}

/** Whether a chart `width` pixels wide is narrow, so its axes take at most `NARROW_MAX_TICKS` ticks. */
export function isNarrowChart(width) {
  return width < NARROW_CHART_WIDTH;
}

/** The first, third, fifth… of `ticks`: half as many, from the first. */
export function everyOther(ticks) {
  return ticks.filter((tick, index) => index % 2 === 0);
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

/** A tick of an axis in percent, from 0 to 100, as it is written: 50 → "50%". */
export function percentTick(percent) {
  return `${percent}%`;
}

/**
 * The weeks (Sundays, in order) whose tick a week axis labels: the first week of each month, leaving out any that
 * comes fewer than `MIN_WEEKS_BETWEEN_LABELS` weeks before the next one, so labels never crowd.
 */
export function firstWeekOfEachMonth(weeks) {
  const firsts = [];
  for (let index = 0; index < weeks.length; index += 1) {
    const month = weeks[index].slice(0, MONTH_LENGTH);
    if (index === 0 || weeks[index - 1].slice(0, MONTH_LENGTH) !== month) {
      firsts.push(weeks[index]);
    }
  }
  const labelled = [];
  for (let index = 0; index < firsts.length; index += 1) {
    const isLast = index === firsts.length - 1;
    if (isLast || weeksBetween(firsts[index], firsts[index + 1]) >= MIN_WEEKS_BETWEEN_LABELS) {
      labelled.push(firsts[index]);
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

/**
 * A week axis's tick format over `weeks` (entries of `weeks.json`, `{ week, last_day }`, oldest first): every month the
 * weeks span, the first and the last included, labelled once, "May", on the first week whose Sunday falls in it, or,
 * for a last month in which no Sunday falls (the weeks end in its first days), on the last week; every other week
 * unlabelled. Labels three or more weeks apart keep apart on a phone.
 */
export function monthTickFormat(weeks) {
  const labels = new Map();
  const labelledMonths = new Set();
  for (const entry of weeks) {
    const month = entry.week.slice(0, MONTH_LENGTH);
    if (!labelledMonths.has(month)) {
      labelledMonths.add(month);
      labels.set(entry.week, shortMonth(entry.week));
    }
  }
  const last = weeks.at(-1);
  if (last !== undefined && !labelledMonths.has(last.last_day.slice(0, MONTH_LENGTH)) && !labels.has(last.week)) {
    labels.set(last.week, shortMonth(last.last_day));
  }
  return (week) => labels.get(week) ?? "";
}

/**
 * The ticks of an elapsed-time axis over `[start, end]`, in seconds: every multiple within it of the smallest round
 * step that gives at most `maxTicks` intervals over the range, or of a whole number of seconds when even a week is too
 * fine.
 */
export function elapsedTicks([start, end], maxTicks) {
  const span = end - start;
  const step = TICK_STEPS_S.find((seconds) => span / seconds <= maxTicks) ?? Math.ceil(span / maxTicks);
  const ticks = [];
  for (let tick = Math.ceil(start / step) * step; tick <= end; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

/** The most ticks an axis `width` pixels wide holds without its labels touching: at least two, at most `MAX_TICKS`. */
export function tickCount(width) {
  return Math.min(MAX_TICKS, Math.max(2, Math.floor(width / TICK_SPACING_PX)));
}

/**
 * The elapsed-time x axis over `[start, end]` seconds of a chart `width` pixels wide: `{ ticks, tickFormat, label }`,
 * its ticks in h:mm from an hour on (in h:mm:ss when a tick falls between whole minutes), else in m:ss, its title
 * naming which.
 */
export function elapsedAxis([start, end], width) {
  const ticks = elapsedTicks([start, end], tickCount(width));
  const { format, unit } = elapsedTickFormat(end);
  // Past an hour, ticks a few seconds apart would all read as the same minute in h:mm.
  if (unit === "h:mm" && ticks.some((tick) => tick % SECONDS_PER_MINUTE !== 0)) {
    return { ticks, tickFormat: formatElapsed, label: "Time since first request (h:mm:ss)" };
  }
  return { ticks, tickFormat: format, label: `Time since first request (${unit})` };
}

// The whole weeks from the Sunday `first` to the Sunday `last`.
function weeksBetween(first, last) {
  const days = (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / MILLISECONDS_PER_DAY;
  return days / DAYS_PER_WEEK;
}
