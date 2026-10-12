/**
 * The three parts of a request's tokens, as every view of the Session page draws and names them: cached input,
 * uncached input and output. `request` is a row of `session/session_requests`.
 */

import { TOKEN_PART_COLOURS } from "../theme/colours.js";

/** Each part's name, as legends, tooltips and areas write it, by the key `tokenParts` gives its tokens under. */
export const TOKEN_PART_NAMES = Object.freeze({ cached: "Cached input", uncached: "Uncached input", output: "Output" });

/** The legend entries of the three parts, `[{ name, colour }]`, in drawing order. */
export function tokenPartEntries() {
  const entries = [];
  for (const [part, name] of Object.entries(TOKEN_PART_NAMES)) {
    entries.push({ name, colour: TOKEN_PART_COLOURS[part] });
  }
  return entries;
}

/**
 * `{ cached, uncached, output }`, the tokens of each part of `request`. A request whose provider reported no cache
 * reads counts its whole input as uncached.
 */
export function tokenParts(request) {
  if (request.cache_read_tokens === null) {
    return { cached: 0, uncached: request.prompt_tokens, output: request.completion_tokens };
  }
  return { cached: request.cache_read_tokens, uncached: request.uncached_tokens, output: request.completion_tokens };
}
