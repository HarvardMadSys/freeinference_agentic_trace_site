import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

// A header comment longer than this many lines is listed for review. It is a sign to look again, not a failure: every
// sentence a first-time reader needs stays, however long the header (CONTRIBUTING.md, "Docstrings state definitions").
const MAX_HEADER_LINES = 10;

// The folders whose modules are read, as the repository test reads them: the site's JavaScript, the data step's Python
// and the tests' own modules of either language.
const ROOT = new URL("../", import.meta.url);
const MODULE_FOLDERS = [
  { folder: "site/js", recursive: true },
  { folder: "site_data", recursive: true },
  { folder: "tests", recursive: false },
];

// The lines of a module's header comment, counted from its first line to its last, delimiters included: a JavaScript
// module's opening block comment or run of `//` lines, a Python module's docstring; 0 for a module with none.
function headerLineCount(text, isPython) {
  const lines = text.split("\n");
  if (isPython) {
    return closedBlockLength(lines, '"""', '"""');
  }
  if (lines[0].startsWith("/*")) {
    return closedBlockLength(lines, "/*", "*/");
  }
  let count = 0;
  while (count < lines.length && lines[count].startsWith("//")) {
    count += 1;
  }
  return count;
}

// The lines from the first, when it opens with `opener`, to the first that holds `closer` after the opener; 0 when the
// first line does not open such a block.
function closedBlockLength(lines, opener, closer) {
  if (!lines[0].startsWith(opener)) {
    return 0;
  }
  for (let index = 0; index < lines.length; index += 1) {
    const searchFrom = index === 0 ? opener.length : 0;
    if (lines[index].indexOf(closer, searchFrom) !== -1) {
      return index + 1;
    }
  }
  return lines.length;
}

// Every module of `MODULE_FOLDERS` with its header's line count, `[{ path, headerLines }]`, by path.
function moduleHeaders() {
  const headers = [];
  for (const { folder, recursive } of MODULE_FOLDERS) {
    for (const name of readdirSync(new URL(`${folder}/`, ROOT), { recursive })) {
      const isPython = name.endsWith(".py");
      if (isPython || name.endsWith(".js")) {
        const text = readFileSync(new URL(`${folder}/${name}`, ROOT), "utf8");
        headers.push({ path: `${folder}/${name}`, headerLines: headerLineCount(text, isPython) });
      }
    }
  }
  return headers.sort((first, second) => first.path.localeCompare(second.path));
}

test("a header's lines are counted from its opening line to its closing one", () => {
  assert.equal(headerLineCount("/**\n * The kind.\n */\n\nimport x;", false), 3);
  assert.equal(headerLineCount("// One line.\n// Two lines.\nconst a = 1;", false), 2);
  assert.equal(headerLineCount('"""One line."""\n\nimport re', true), 1);
  assert.equal(headerLineCount('"""The states.\n\nTheir units.\n"""\n', true), 4);
  assert.equal(headerLineCount("import assert;\n", false), 0);
});

test("module headers over ten lines are listed for review, never failed", (context) => {
  const longHeaders = moduleHeaders().filter((header) => header.headerLines > MAX_HEADER_LINES);
  for (const header of longHeaders) {
    context.diagnostic(`warning: ${header.path} has a header of ${header.headerLines} lines`);
  }
  const summary = `${longHeaders.length} module headers over ${MAX_HEADER_LINES} lines, each to be looked at again`;
  context.diagnostic(`warning: ${summary}`);
});
