# Spec Delta

## Purpose

The Session page without a scope in its facts, and its way back to the
Explore page's sessions table.

## MODIFIED Requirements

### Requirement: Session facts
The Session page SHALL show a stat strip with:
- harness and models (each with its number of requests);
- started time (UTC) and duration;
- turns and requests, the top-level session's and its subagents' given
  apart;
- subagents and tool calls;
- input, cached and output tokens, and the cached share of input.

A link SHALL return to the Explore page's sessions table with the selection,
sort, filters and page the visitor came from.

#### Scenario: A session with subagents
- **WHEN** the session spawned three subagents that made 40 requests in all
- **THEN** the strip SHALL count three subagents and give the 40 requests apart from the top-level session's own

#### Scenario: Back to the table
- **WHEN** the visitor opened the session from the table sorted by duration on page 2
- **THEN** the back link SHALL open the Explore page at the sessions table, sorted by duration, on page 2
