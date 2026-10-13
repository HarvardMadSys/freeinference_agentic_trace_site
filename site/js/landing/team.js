/**
 * The Team section: the lab and its collaborators, and the paper's authors with their affiliations. The header, the
 * hero and the footer carry the links to the dataset, the code and the rest.
 */

import { URLS } from "../shared/layout.js";

// The paper's authors in its order, each with their affiliation, short so the five fit one row.
const AUTHORS = Object.freeze([
  Object.freeze({ name: "William Nixon", affiliation: "UChicago & Harvard" }),
  Object.freeze({ name: "Muxin Tian", affiliation: "Toronto" }),
  Object.freeze({ name: "Yunjia Zheng", affiliation: "Harvard" }),
  Object.freeze({ name: "Haryadi S. Gunawi", affiliation: "UChicago" }),
  Object.freeze({ name: "Juncheng Yang", affiliation: "Harvard" }),
]);

/** Fill `container` with the Team section's content: its heading and the authors. */
export function renderTeam(container) {
  const authors = AUTHORS.map((author) => `<li><strong>${author.name}</strong><span>${author.affiliation}</span></li>`);
  container.innerHTML = `
    <div class="team-heading">
      <div>
        <p class="eyebrow"><span class="eyebrow-mark" aria-hidden="true"></span>Team</p>
        <h2 id="team-title">Contributors</h2>
      </div>
      <p><a href="${URLS.lab}" target="_blank" rel="noopener">Harvard MadSys</a> and collaborators.</p>
    </div>
    <ul class="team-list">${authors.join("")}</ul>`;
}

