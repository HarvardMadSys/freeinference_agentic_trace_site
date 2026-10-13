# Tasks

Every task ends with `make test` green and one commit. A task that touches
a view checks it in a browser at 1280 and 360 px, light and dark. Task 6
reruns `make data`; the others change no query and no data.

- [x] 1.1 Back and the tabs (design §2): history state, the ARIA tabs pattern, the tab row mounted before the fetch, the caught `onShow`; tests with a fake history.
- [x] 2.1 The start module for one page and the minor findings (design §8).
- [x] 3.1 Colours (design §3): the tool category tokens, the harness slot offset, the role hue; the distinctness and contrast tests.
- [x] 4.1 The phone header and the wide header's breakpoint (design §4).
- [ ] 5.1 Keyboard and screen readers (design §5): the table's sort buttons, the charts' names, the legends' roving focus, `aria-current`, the Session page's headings, the focus ring.
- [ ] 6.1 The Overview over every harness and the Session Explorer's first page (design §1, §6): the queries, `answers.py`, `make data`, the table's two-stage load, the donut captions without "human-driven"; the data committed.
- [ ] 7.1 Charts (design §7): the API cost legend, bars from zero, the gap-bin labels, the ratio annotation, the trends' width and ticks, the histogram's bins, the phone donut legend, the BibTeX wrap.
- [ ] 8.1 README, CONTRIBUTING, CLAUDE.md where they describe the changed parts; `openspec validate review-pass --strict`; a browser pass over the page and a session.
