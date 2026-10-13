## MODIFIED Requirements

### Requirement: Session facts
Beside the title, one card SHALL list the session's facts as labelled
fields in three columns (one on a phone): harness;
models, each with its requests; started (UTC); duration; turns; requests;
input tokens; cached share with the cached tokens; output tokens;
subagents; tool calls. A link above the title, "← Session Explorer",
SHALL lead back to the Session Explorer page with its state.

#### Scenario: A session with subagents
- **WHEN** a session has three subagent sessions
- **THEN** the subagents field SHALL read 3 and the requests field SHALL count the top-level session's own requests

#### Scenario: Back to the table
- **WHEN** the visitor follows the back link
- **THEN** the Session Explorer page SHALL open with the same filters, sort and page
