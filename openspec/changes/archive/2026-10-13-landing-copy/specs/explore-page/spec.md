## MODIFIED Requirements

### Requirement: Hero and stats strip
The page SHALL open with a hero: the title "FreeInference Agentic
Dataset" with "Agentic Dataset" in the accent colour and no eyebrow above
it, the lede "16 weeks worth of production agent traces from FreeInference
across diverse agent harnesses, with latency, tool, and KV block
information." whose week count is read from `weeks.json` and written in
digits, five buttons:
"Session Explorer" to the Session Explorer section, "Insights" to the
Insights section, "Dataset" (the Hugging Face dataset),
the paper and the code, and under them the lab's name "Harvard SEAS ·
MadSys Lab" linking to the lab. Beside it a stats strip SHALL show, computed from
the `trace_totals` answer and never typed, the whole trace as the paper's
summary table counts it: the weeks, sessions, requests, input tokens, tool
calls and harnesses written "13 (+1)", and a line naming the span of
dates. The strip SHALL NOT mention the benchmark.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** the hero and the stats strip SHALL be visible before any figure, and the strip's sessions SHALL equal the Session Explorer's count

#### Scenario: A stat is counted, not typed
- **WHEN** the data gains a week and `make data` reruns
- **THEN** the stats strip SHALL show the new counts without an edit to the page

#### Scenario: The site buttons
- **WHEN** the visitor presses "Session Explorer" or "Insights"
- **THEN** the page SHALL scroll to that section

#### Scenario: The lede counts the weeks
- **WHEN** the data gains a week
- **THEN** the lede SHALL open "17 weeks worth of" without an edit to the page

### Requirement: Cite, Team and footer
The page SHALL end with a Cite section holding the paper's BibTeX in a
block with a copy button; a Team section naming Harvard MadSys and
collaborators and the paper's authors with their affiliations, and no
About paragraph; and a footer with the brand
line "FreeInference Agentic
Dataset", the line "Sixteen weeks worth of coding agent traces from
FreeInference.", the lab's name "Harvard SEAS · MadSys Lab" linking to the
lab, and the on-site and elsewhere links, and nothing
else: no copyright line and no policy links. Every link that leaves the
site, on any page, SHALL show an arrow after its text.

#### Scenario: Copying the citation
- **WHEN** the visitor presses the copy button
- **THEN** the BibTeX SHALL be on the clipboard unchanged

#### Scenario: The footer
- **WHEN** the visitor reaches the end of the page
- **THEN** the footer SHALL show the brand, its line, the lab's name and the two groups of links, and no copyright or policy text

#### Scenario: Cite from another page
- **WHEN** the visitor follows the header's Cite link on the Session page
- **THEN** the Explore page SHALL open at the Cite section

#### Scenario: A link off the site
- **WHEN** the visitor looks at the hero's Paper button or the footer's Dataset link
- **THEN** each SHALL end in an arrow, and the Session Explorer link SHALL not
