/**
 * Numbers and names as every page shows them: counts, token totals, durations, elapsed time, shares, a session's
 * short id, a UTC minute and a week's month and day; and the two definitions they rest on, elapsed seconds and the
 * cached share.
 */

// A token total is shown in the largest of these units it reaches.
const TOKEN_UNITS = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

/** The text of a value that has none, such as a share of nothing or a median over no rows. */
export const MISSING_TEXT = "—";

/** The release's times are in milliseconds; the pages write seconds. */
export const MILLISECONDS_PER_SECOND = 1000;

// The characters of a session id that name it on a page; 8 hex characters tell sessions apart.
const SHORT_ID_LENGTH = 8;

// The characters of an ISO 8601 time that make up "YYYY-MM-DDTHH:MM".
const MINUTE_LENGTH = "YYYY-MM-DDTHH:MM".length;

// The characters of a week's Sunday before its month: "YYYY-".
const YEAR_PREFIX_LENGTH = "YYYY-".length;

/** A count with thousands separators: 1186582 → "1,186,582". */
export function formatCount(count) {
  return count.toLocaleString("en-US");
}

/** A count and its noun, singular for one: (1, "agent", "agents") → "1 agent"; (1186582, …) → "1,186,582 agents". */
export function formatQuantity(count, singular, plural) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

/** A token total in B, M or k with one decimal: 129087 → "129.1k"; under a thousand, the count itself. */
export function formatTokens(tokens) {
  for (const [size, suffix] of TOKEN_UNITS) {
    if (tokens >= size) {
      return withoutTrailingZero((tokens / size).toFixed(1)) + suffix;
    }
  }
  return formatCount(tokens);
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

/** Time since a session's start, as "+MM:SS", or "+H:MM:SS" from an hour on. */
export function formatElapsed(seconds) {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const rest = wholeSeconds % 60;
  if (hours > 0) {
    return `+${hours}:${padded(minutes)}:${padded(rest)}`;
  }
  return `+${padded(minutes)}:${padded(rest)}`;
}

/** A share of one as a percentage with one decimal: 0.632 → "63.2%". */
export function formatShare(share) {
  return `${(share * 100).toFixed(1)}%`;
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

/** A week's Sunday as its month and day, for a crowded axis: "2026-08-09" → "08-09". */
export function monthAndDay(week) {
  return week.slice(YEAR_PREFIX_LENGTH);
}

function padded(number) {
  return String(number).padStart(2, "0");
}

function withoutTrailingZero(text) {
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}
