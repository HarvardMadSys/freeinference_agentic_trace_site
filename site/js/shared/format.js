/** Numbers as every page shows them: counts, token totals, durations, elapsed time and shares. */

// A token total is shown in the largest of these units it reaches.
const TOKEN_UNITS = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

// The text of a share that has no value.
const MISSING_SHARE = "—";

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
  return share === null ? MISSING_SHARE : formatShare(share);
}

function padded(number) {
  return String(number).padStart(2, "0");
}

function withoutTrailingZero(text) {
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}
