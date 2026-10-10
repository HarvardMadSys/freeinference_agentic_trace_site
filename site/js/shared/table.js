/**
 * A table the visitor sorts, searches, filters and pages in the browser.
 *
 * The pure functions take an array of row objects and return a new one; the
 * page chains them and passes the result to `mountTable`, which draws one page
 * of it. The module keeps no state: the page calls `mountTable` again whenever
 * the sort, the search, a filter or the page changes.
 */

// Rows shown on one page of a table.
export const ROWS_PER_PAGE = 50;

// The mark after a sorted column's title, by sort direction.
const SORT_ARROWS = { ascending: "▲", descending: "▼" };

/** A new array of `rows` sorted by `row[key]` in `direction` ("ascending" or "descending"); missing values last, ties in input order. */
export function sortRows(rows, key, direction) {
  const sign = direction === "descending" ? -1 : 1;
  return [...rows].sort((first, second) => compareValues(first[key], second[key], sign));
}

/** The rows whose `row[key]`, as text, contains `text`, ignoring case; every row when `text` is empty. */
export function searchRows(rows, key, text) {
  const wanted = text.toLowerCase();
  return rows.filter((row) => String(row[key]).toLowerCase().includes(wanted));
}

/** The rows matching every condition, each `{ key, equals: value }` or `{ key, atLeast: number }`; every row when there is none. */
export function filterRows(rows, conditions) {
  return rows.filter((row) => matchesEveryCondition(row, conditions));
}

/** Page `pageNumber` (1-based, clamped into 1 to `pageCount`) of `rows`: `{ rows, pageCount, pageNumber }`; `pageCount` is at least 1. */
export function pageRows(rows, pageNumber, rowsPerPage) {
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const clampedPageNumber = Math.min(Math.max(pageNumber, 1), pageCount);
  const start = (clampedPageNumber - 1) * rowsPerPage;
  return { rows: rows.slice(start, start + rowsPerPage), pageCount, pageNumber: clampedPageNumber };
}

/**
 * Fill `container` with an optional summary line, one page of `rows` as a table, and a pager.
 * `columns` is `[{ key, title, format, isNumber, href }]`; `href(row)`, when given, makes the cell a link to that
 * address. `sort` is `{ key, direction }`.
 * Clicking a header calls `onSort(key)`, a pager button `onPage(pageNumber)`, a row `onRowClick(row)`.
 */
export function mountTable(container, { columns, rows, sort, pageNumber, summary, onSort, onPage, onRowClick }) {
  const page = pageRows(rows, pageNumber, ROWS_PER_PAGE);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  table.append(tableHead(columns, sort, onSort), tableBody(columns, page.rows, onRowClick));
  wrap.append(table);
  container.replaceChildren();
  if (summary) {
    container.append(summaryLine(summary));
  }
  container.append(wrap, pager(page, onPage));
}

/** What a cell of `column` shows for `row`: `{ text, href }`, the formatted value and its link address, or null for none. */
export function cellContent(column, row) {
  const format = column.format ?? String;
  return { text: format(row[column.key]), href: column.href ? column.href(row) : null };
}

function compareValues(first, second, sign) {
  const firstMissing = first === null || first === undefined;
  const secondMissing = second === null || second === undefined;
  if (firstMissing && secondMissing) {
    return 0;
  }
  // Missing values go last whichever way the column is sorted, so the sign is not applied.
  if (firstMissing) {
    return 1;
  }
  if (secondMissing) {
    return -1;
  }
  if (typeof first === "number" && typeof second === "number") {
    return sign * (first - second);
  }
  return sign * String(first).localeCompare(String(second));
}

function matchesEveryCondition(row, conditions) {
  return conditions.every((condition) => matchesCondition(row, condition));
}

function matchesCondition(row, condition) {
  if ("equals" in condition) {
    return row[condition.key] === condition.equals;
  }
  if ("atLeast" in condition) {
    return row[condition.key] >= condition.atLeast;
  }
  throw new Error(`A filter condition on "${condition.key}" needs "equals" or "atLeast".`);
}

function summaryLine(summary) {
  const line = document.createElement("p");
  line.className = "figure-caption";
  line.textContent = summary;
  return line;
}

function tableHead(columns, sort, onSort) {
  const headerRow = document.createElement("tr");
  for (const column of columns) {
    headerRow.append(headerCell(column, sort, onSort));
  }
  const head = document.createElement("thead");
  head.append(headerRow);
  return head;
}

function headerCell(column, sort, onSort) {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = column.title;
  if (column.isNumber) {
    cell.classList.add("is-number");
  }
  if (sort && sort.key === column.key) {
    cell.classList.add("is-sorted");
    cell.setAttribute("aria-sort", sort.direction);
    cell.textContent = `${column.title} ${SORT_ARROWS[sort.direction]}`;
  }
  if (onSort) {
    cell.addEventListener("click", () => onSort(column.key));
  }
  return cell;
}

function tableBody(columns, rows, onRowClick) {
  const body = document.createElement("tbody");
  for (const row of rows) {
    body.append(bodyRow(columns, row, onRowClick));
  }
  return body;
}

function bodyRow(columns, row, onRowClick) {
  const tableRow = document.createElement("tr");
  for (const column of columns) {
    const cell = document.createElement("td");
    const content = cellContent(column, row);
    if (content.href === null) {
      cell.textContent = content.text;
    } else {
      cell.append(cellLink(content));
    }
    if (column.isNumber) {
      cell.classList.add("is-number");
    }
    tableRow.append(cell);
  }
  if (onRowClick) {
    tableRow.classList.add("is-clickable");
    tableRow.addEventListener("click", () => onRowClick(row));
  }
  return tableRow;
}

function cellLink(content) {
  const link = document.createElement("a");
  link.href = content.href;
  link.textContent = content.text;
  // The link opens its address itself, in this tab or a new one; the row's own click must not open it again.
  link.addEventListener("click", (event) => event.stopPropagation());
  return link;
}

function pager(page, onPage) {
  const previous = pagerButton("Prev", page.pageNumber - 1, page.pageNumber === 1, onPage);
  const next = pagerButton("Next", page.pageNumber + 1, page.pageNumber === page.pageCount, onPage);
  const position = document.createElement("span");
  position.className = "control-label";
  position.textContent = `Page ${page.pageNumber} of ${page.pageCount}`;
  const controls = document.createElement("div");
  controls.className = "controls";
  controls.append(previous, position, next);
  return controls;
}

function pagerButton(label, targetPageNumber, isDisabled, onPage) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = isDisabled;
  if (onPage) {
    button.addEventListener("click", () => onPage(targetPageNumber));
  }
  return button;
}
