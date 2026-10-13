## MODIFIED Requirements

### Requirement: Navigation and the About page
The site SHALL have two pages, Explore (`index.html`, the landing page)
and Session (`session.html`).
Both SHALL share one sticky header: the brand "FreeInference Agentic
Dataset" linking to the Explore page, the in-page links Overview, Session Explorer,
Insights and Cite, and no link off the site. On a phone the header SHALL
be two rows, the brand on the first and the four links on the second,
wrapping as they need; nothing in the header SHALL scroll sideways or be
cut off. The header SHALL NOT name the lab nor link the
dataset, the paper, the code or Open Data; the hero and the footer do.
The header SHALL stay at the top while the page scrolls,
and every anchored section SHALL land below it. There SHALL be no About
page and no About paragraph; the definitions live behind each card's control, the differences
from the paper in the repository's `docs/differences.md`, and the credits
and citation on the landing page.

#### Scenario: Moving between pages
- **WHEN** the visitor opens a session from the list and follows the header's Session Explorer link
- **THEN** the Explore page SHALL open at the Session Explorer with the list's state kept

#### Scenario: Scrolling
- **WHEN** the visitor scrolls any page
- **THEN** the header SHALL remain visible at the top

#### Scenario: The current page
- **WHEN** the visitor is on the Session page
- **THEN** the header's Session Explorer link SHALL be marked and the others not

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** all four links SHALL be visible under the brand without scrolling the header
