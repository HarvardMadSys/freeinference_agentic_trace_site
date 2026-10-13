/**
 * The Team section: the lab and its collaborators, and the paper's authors with their affiliations. The header, the
 * hero and the footer carry the links to the dataset, the code and the rest.
 */

import { URLS } from "../shared/layout.js";

// The paper's authors in its order, each with their affiliation, short so the five fit one row, and, where they have
// one, their page.
const AUTHORS = Object.freeze([
  Object.freeze({
    name: "William Nixon", affiliation: "UChicago & Harvard",
    url: "https://williamnixon20.github.io/",
  }),
  Object.freeze({ name: "Muxin Tian", affiliation: "Toronto", url: null }),
  Object.freeze({ name: "Yunjia Zheng", affiliation: "Harvard", url: null }),
  Object.freeze({ name: "Haryadi S. Gunawi", affiliation: "UChicago", url: null }),
  Object.freeze({ name: "Juncheng Yang", affiliation: "Harvard", url: "https://juncheng.seas.harvard.edu/" }),
]);

/** Fill `container` with the Team section's content: its heading and the authors. */
export function renderTeam(container) {
  const authors = AUTHORS.map((author) => `<li>${authorName(author)}<span>${author.affiliation}</span></li>`);
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

// An author's name in bold, linking to their page where they have one.
function authorName(author) {
  const name = `<strong>${author.name}</strong>`;
  return author.url === null ? name : `<a href="${author.url}" target="_blank" rel="noopener">${name}</a>`;
}
