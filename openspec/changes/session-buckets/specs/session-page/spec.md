## REMOVED Requirements

### Requirement: Opening a session
**Reason**: the page no longer queries a week's files in DuckDB; it reads one bucket.
**Migration**: the bucket requirement below replaces it; the step and view links keep their form.

## ADDED Requirements

### Requirement: Opening a session from a bucket
The Session page SHALL open at `session.html?week=<sunday>&id=<session_id>`,
optionally with `&step=<step>` and `&view=requests|context|timeline`
(`requests` by default).
- It SHALL fetch the bucket `data/session_buckets/<week>/<xx>.json.gz`,
  `xx` the first two characters of the id, decompress it in the browser
  (or read it as text when the host already decompressed it), and draw
  the session from the bucket's entry for that id.
- An id the bucket does not hold SHALL be looked up in the week's
  `index.json.gz`; a subagent's id SHALL thereby open its top-level
  session with the subagent's group expanded.
- An id in neither SHALL show "session not found in this week".
- The page SHALL load no DuckDB module, no Parquet file and no SQL; it
  SHALL show its loading line until the bucket is parsed.

#### Scenario: One bucket per session
- **WHEN** a top-level session of week W is opened by its id
- **THEN** exactly one `session_buckets/W/…json.gz` file SHALL be fetched, and no `.wasm`, `.parquet` or `.sql`

#### Scenario: A subagent's id
- **WHEN** the id is a subagent session
- **THEN** the page SHALL fetch its prefix's bucket, then the week's index, then the top-level session's bucket, and show the top-level session with that subagent's group expanded and scrolled into view

#### Scenario: A shared link to a step
- **WHEN** a visitor opens `session.html?week=2026-08-09&id=S&step=12`
- **THEN** the page SHALL open the Requests view, scroll to step 12 and highlight it

#### Scenario: A host that decompresses
- **WHEN** the host serves the bucket with the gzip layer already removed
- **THEN** the page SHALL read it as JSON and draw the session all the same
