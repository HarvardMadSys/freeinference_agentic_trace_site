# Change: landing-copy

## Why
The landing page's words were written for the paper's readers. The hero's
lede said "anonymised" before it said what the trace is for; the Team
section carried an About paragraph the hero already covers; the lab's
name sat in the header, where it is not needed, and nowhere else; and a
link that leaves the site looked like one that does not.

## What changes
- **The lede.** "16 weeks worth of production agent traces from
  FreeInference across diverse agent harnesses, with latency, tool, and
  KV block information." The week count is still read from `weeks.json`,
  in digits.
- **No About paragraph.** The Team section is the heading and the
  authors.
- **The lab's name moves.** "Harvard SEAS · MadSys Lab" leaves the
  header; it is written under the hero's buttons and under the footer's
  line, linking to the lab both times.
- **The header links only the page's sections.** Dataset, Paper, Code
  and Open Data leave it; the hero's buttons and the footer carry them.
- **Arrows on links that leave the site.** Every link that opens in a
  new tab shows an arrow after its text: the hero's Dataset, Paper and
  Code buttons, the footer's Elsewhere
  links, the citation's paper link, the lab and the authors' pages.
- **The footer line** reads "Sixteen weeks worth of coding agent traces
  from FreeInference."

## Impact
- Specs: `explore-page` (the hero, the Team section and the footer),
  `site-repository` (the header).
- Code: `js/landing/hero.js`, `js/landing/team.js`, `js/shared/layout.js`,
  `js/explore/start.js` (the week count reaches the hero), `style.css`;
  the hero, team and layout tests; README's team line.
- Data: none.
