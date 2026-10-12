## MODIFIED Requirements

### Requirement: Navigation and the About page
The site SHALL have two pages, Explore (the landing page) and Session.
Both SHALL share one sticky header: the brand, the affiliation "Harvard
SEAS · MadSys Lab" linking to the lab, the in-page links Overview,
Sessions, Insights and Cite, and the external links Dataset, Paper, Code
and Open Data (on a phone, the brand and the four in-page links alone, on
one row that scrolls sideways, its right edge faded while more links lie
beyond it). The header SHALL stay at the top while the page scrolls,
and every anchored section SHALL land below it. There SHALL be no About
page; the definitions live behind each card's control, the differences
from the paper in the repository's `docs/differences.md`, and the credits
and citation on the landing page.

#### Scenario: Moving between pages
- **WHEN** the visitor opens a session from the list and follows the header's Sessions link
- **THEN** the Explore page SHALL open at the Sessions section with the list's state kept

#### Scenario: Scrolling
- **WHEN** the visitor scrolls the Explore page
- **THEN** the header SHALL remain visible at the top
