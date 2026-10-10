/** The cached share of input: what the headline and the sessions table show, defined once. */

/** Cached over reported input tokens; null when no input was reported, since a share of nothing has no value. */
export function cachedShare(cachedTokens, reportedInputTokens) {
  return reportedInputTokens > 0 ? cachedTokens / reportedInputTokens : null;
}
