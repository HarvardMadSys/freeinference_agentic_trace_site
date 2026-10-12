/**
 * The Team section: the lab and its collaborators, the paper's authors with their affiliations, and a paragraph on
 * what the site is, with links to the dataset, the code, Open Data and FreeInference.
 */

import { URLS } from "../shared/layout.js";

// The paper's authors in its order, each with their affiliation and, where they have one, their page.
const AUTHORS = Object.freeze([
  Object.freeze({
    name: "William Nixon", affiliation: "University of Chicago & Harvard University",
    url: "https://williamnixon20.github.io/",
  }),
  Object.freeze({ name: "Muxin Tian", affiliation: "University of Toronto", url: null }),
  Object.freeze({ name: "Yunjia Zheng", affiliation: "Harvard University", url: null }),
  Object.freeze({ name: "Haryadi S. Gunawi", affiliation: "University of Chicago", url: null }),
  Object.freeze({ name: "Juncheng Yang", affiliation: "Harvard University", url: "https://juncheng.seas.harvard.edu/" }),
]);

const ABOUT = "We study LLM and agent serving to improve efficiency and broaden access to AI. This site draws the "
  + "paper's figures over the FreeInference agentic trace and opens any of its sessions.";

// The links under the About paragraph.
const ABOUT_LINKS = Object.freeze([
  Object.freeze({ title: "The dataset on Hugging Face", url: URLS.dataset }),
  Object.freeze({ title: "The code on GitHub", url: URLS.code }),
  Object.freeze({ title: "Open Data", url: URLS.openData }),
  Object.freeze({ title: "FreeInference", url: URLS.freeInference }),
]);

/** Fill `container` with the Team section's content: its heading, the authors, and the About paragraph. */
export function renderTeam(container) {
  const authors = AUTHORS.map((author) => `<li>${authorName(author)}<span>${author.affiliation}</span></li>`);
  const links = ABOUT_LINKS.map((link) => `<a href="${link.url}" target="_blank" rel="noopener">${link.title}</a>`);
  container.innerHTML = `
    <div class="team-heading">
      <div>
        <p class="eyebrow"><span class="eyebrow-mark" aria-hidden="true"></span>Team</p>
        <h2 id="team-title">Contributors</h2>
      </div>
      <p><a href="${URLS.lab}" target="_blank" rel="noopener">Harvard MadSys</a> and collaborators.</p>
    </div>
    <ul class="team-list">${authors.join("")}</ul>
    <div class="team-about">
      <p class="eyebrow"><span class="eyebrow-mark" aria-hidden="true"></span>About</p>
      <p>${ABOUT}</p>
      <div class="arrow-links">${links.join("")}</div>
    </div>`;
}

// An author's name in bold, linking to their page where they have one.
function authorName(author) {
  const name = `<strong>${author.name}</strong>`;
  return author.url === null ? name : `<a href="${author.url}" target="_blank" rel="noopener">${name}</a>`;
}
