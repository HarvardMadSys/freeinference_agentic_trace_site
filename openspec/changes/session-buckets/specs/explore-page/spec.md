## MODIFIED Requirements

### Requirement: Hero and stats strip
The page SHALL open with a hero: the title "FreeInference Agentic
Dataset" with "Agentic Dataset" in the accent colour and no eyebrow above
it, a lede whose first clause counts the weeks, and four buttons:
"Insights" to the Insights section, "Dataset" (the Hugging Face dataset),
the paper and the code. Beside it a stats strip SHALL show, computed from
the `trace_totals` answer and never typed, the whole trace as the paper's
summary table counts it: the weeks, sessions, requests, input tokens, tool
calls and harnesses (the benchmark's counted as "+ 1", with a tooltip
saying so), and a line naming the span of dates and how many sessions are
a benchmark replay left out of the mixes and the Insights.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** the hero and the stats strip SHALL be visible before any figure, and the strip's sessions SHALL equal the Session Explorer's count

#### Scenario: A stat is counted, not typed
- **WHEN** the data gains a week and `make data` reruns
- **THEN** the stats strip SHALL show the new counts without an edit to the page
