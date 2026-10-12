/**
 * Numbers and names as every page shows them: counts, compact counts and token totals, durations and duration ticks,
 * elapsed time and its ticks, shares and whole percentages, multiples, a session's short id, a UTC minute, a week's month
 * and day and a span of months; and the two definitions they rest on, elapsed seconds and the cached share.
 */

// A compact count is shown in the largest of these units it reaches.
const COMPACT_UNITS = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

// A duration tick is written in the largest of these units it reaches, else in seconds.
const DURATION_TICK_UNITS = [
  [86400, "d"],
  [3600, "h"],
  [60, "min"],
];

// A power-of-two bin of tokens is named in these, as 4k or 256k.
const TOKENS_PER_BINARY_THOUSAND = 1024;

// The unit of a TTL's name, by its last letter, as a duration is written: "1m" is "1 min", never "1m".
const TTL_UNITS = Object.freeze({ s: "s", m: "min", h: "h", d: "d" });

/** The text of a value that has none, such as a share of nothing or a median over no rows. */
export const MISSING_TEXT = "—";

/** The release's times are in milliseconds; the pages write seconds. */
export const MILLISECONDS_PER_SECOND = 1000;

// The characters of a session id that name it on a page; 8 hex characters tell sessions apart.
const SHORT_ID_LENGTH = 8;

// The characters of an ISO 8601 time that make up "YYYY-MM-DDTHH:MM".
const MINUTE_LENGTH = "YYYY-MM-DDTHH:MM".length;

// The characters of a date's year, "YYYY", and of a whole date, "YYYY-MM-DD".
const YEAR_LENGTH = "YYYY".length;
const DAY_LENGTH = "YYYY-MM-DD".length;

const SECONDS_PER_HOUR = 3600;

/** A count with thousands separators: 1186582 → "1,186,582". */
export function formatCount(count) {
  return count.toLocaleString("en-US");
}

/** A count and its noun, singular for one: (1, "agent", "agents") → "1 agent"; (1186582, …) → "1,186,582 agents". */
export function formatQuantity(count, singular, plural) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

/** A count in B, M or k with one decimal: 129087 → "129.1k", 1000 → "1k"; under a thousand, the count itself. */
export function formatCompactCount(count) {
  for (const [size, suffix] of COMPACT_UNITS) {
    if (count >= size) {
      return withoutTrailingZero((count / size).toFixed(1)) + suffix;
    }
  }
  return formatCount(count);
}

/** A power-of-two count of tokens as such bins are named: 4096 → "4k", 262144 → "256k"; under 1,024, the count. */
export function formatBinaryThousands(tokens) {
  return tokens < TOKENS_PER_BINARY_THOUSAND ? formatCount(tokens) : `${tokens / TOKENS_PER_BINARY_THOUSAND}k`;
}

/** A token total as a compact count: 129087 → "129.1k". */
export function formatTokens(tokens) {
  return formatCompactCount(tokens);
}

/** A duration: under a minute "4.2s", under an hour "12m 04s", otherwise "1h 03m". */
export function formatSeconds(seconds) {
  if (seconds < 60) {
    return `${withoutTrailingZero(seconds.toFixed(1))}s`;
  }
  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${padded(wholeSeconds % 60)}s`;
  }
  return `${Math.floor(minutes / 60)}h ${padded(minutes % 60)}m`;
}

/** A duration as an axis writes it: "30 s" under a minute, then "2 min", "1.3 min", "1 h" or "7 d", one decimal at most. */
export function formatDurationTick(seconds) {
  for (const [size, unit] of DURATION_TICK_UNITS) {
    if (seconds >= size) {
      return `${Number((seconds / size).toFixed(1))} ${unit}`;
    }
  }
  return `${seconds} s`;
}

/** A TTL's name as the simulation gives it, written as every duration is: "1m" → "1 min", "10s" → "10 s", "1d" → "1 d". */
export function formatTtlName(ttl) {
  return `${ttl.slice(0, -1)} ${TTL_UNITS[ttl.slice(-1)]}`;
}

/** Time since a session's start, as "M:SS", or "H:MM:SS" from an hour on: 83.9 → "1:23", 3661 → "1:01:01". */
export function formatElapsed(seconds) {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const rest = wholeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${padded(minutes)}:${padded(rest)}`;
  }
  return `${minutes}:${padded(rest)}`;
}

/**
 * How an elapsed-time axis reaching `maxSeconds` writes its ticks: `{ format, unit }`, in hours and minutes ("1:10",
 * unit "h:mm") from an hour on, else in minutes and seconds ("12:30", unit "m:ss").
 */
export function elapsedTickFormat(maxSeconds) {
  if (maxSeconds >= SECONDS_PER_HOUR) {
    return { format: hoursAndMinutes, unit: "h:mm" };
  }
  return { format: formatElapsed, unit: "m:ss" };
}

/** A share of one as a whole percentage, as an axis writes it: 0.632 → "63%", 1 → "100%". */
export function formatPercent(share) {
  return `${Math.round(share * 100)}%`;
}

/** A share of one as a percentage with one decimal: 0.632 → "63.2%". */
export function formatShare(share) {
  return `${(share * 100).toFixed(1)}%`;
}

/** A multiple and a times sign, with `decimals` decimals when given, else as it is: (1.3757, 2) → "1.38×"; 2 → "2×". */
export function formatMultiple(multiple, decimals) {
  const digits = decimals === undefined ? String(multiple) : multiple.toFixed(decimals);
  return `${digits}×`;
}

/** A share as `formatShare` writes it, or "—" for a missing share (null), such as a share of nothing. */
export function formatOptionalShare(share) {
  return share === null ? MISSING_TEXT : formatShare(share);
}

/** The seconds from `originMs` to `timeMs`, both in milliseconds. */
export function elapsedSeconds(timeMs, originMs) {
  return (timeMs - originMs) / MILLISECONDS_PER_SECOND;
}

/** Cached over reported input tokens; null when no input was reported, since a share of nothing has no value. */
export function cachedShare(cachedTokens, reportedInputTokens) {
  return reportedInputTokens > 0 ? cachedTokens / reportedInputTokens : null;
}

/** The short name of a session: the first eight characters of its id. */
export function shortSessionId(sessionId) {
  return sessionId.slice(0, SHORT_ID_LENGTH);
}

/** A time in milliseconds since the epoch as its UTC minute: "2026-08-09 14:03". */
export function utcMinute(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, MINUTE_LENGTH).replace("T", " ");
}

/** A week's Sunday as its month and day, as an axis writes it: "2026-08-09" → "Aug 9". */
export function monthAndDay(week) {
  const sunday = new Date(`${week}T00:00:00Z`);
  return sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The month of a date, short, as an axis writes it: "2026-08-09" → "Aug". */
export function shortMonth(date) {
  const day = new Date(`${date}T00:00:00Z`);
  return day.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

/** A UTC minute as a table writes it, month, day and time: 1788144240000 → "Aug 31, 02:44". */
export function shortMinute(milliseconds) {
  const minute = utcMinute(milliseconds);
  return `${monthAndDay(minute.slice(0, DAY_LENGTH))}, ${minute.slice(DAY_LENGTH + 1)}`;
}

/** A month as its name and year: "2026-05" → "May 2026". */
export function monthName(month) {
  const firstDay = new Date(`${month}-01T00:00:00Z`);
  return firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The months from `firstMonth` to `lastMonth`: "May to August 2026", "December 2025 to January 2026", "May 2026". */
export function monthSpanText(firstMonth, lastMonth) {
  if (firstMonth === lastMonth) {
    return monthName(firstMonth);
  }
  const sameYear = firstMonth.slice(0, YEAR_LENGTH) === lastMonth.slice(0, YEAR_LENGTH);
  const first = sameYear ? monthWithoutYear(firstMonth) : monthName(firstMonth);
  return `${first} to ${monthName(lastMonth)}`;
}

function monthWithoutYear(month) {
  const firstDay = new Date(`${month}-01T00:00:00Z`);
  return firstDay.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}

function hoursAndMinutes(seconds) {
  const wholeMinutes = Math.floor(seconds / 60);
  return `${Math.floor(wholeMinutes / 60)}:${padded(wholeMinutes % 60)}`;
}

function padded(number) {
  return String(number).padStart(2, "0");
}

function withoutTrailingZero(text) {
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}
