/**
 * The Session page's data, as the data step precomputed it: a session's rows from its week's bucket, the order of the
 * tool categories, and the number of weeks.
 *
 * A bucket is `session_buckets/<week>/<xx>.json.gz` in the data folder, `xx` the first two characters of a top-level
 * session's id: an object from each top-level id whose id starts with `xx` to its entry, `{ tree, requests,
 * tool_calls }`, each part `{ columns, rows }` with a row's values in column order (`site_data/buckets.py`). Beside the
 * buckets, the week's `index.json.gz` maps every session id of the week, subagents included, to its top-level id. A
 * prefix with no top-level session in the week has no bucket.
 */

// The folder of every week's buckets in the data folder.
const BUCKETS_FOLDER = "session_buckets";

// A bucket holds the top-level sessions whose ids share this many first characters, as the data step writes them.
const PREFIX_LENGTH = 2;

// The ending of a bucket's file name after its prefix.
const BUCKET_SUFFIX = ".json.gz";

// The week's index of session ids, in the week's bucket folder.
const INDEX_FILE = "index.json.gz";

// The answer of `setup/category_order` in the data folder: the order that fixes each tool category's colour.
const CATEGORY_ORDER_FILE = "all_weeks/setup/category_order.json";

// The index of the weeks in the data folder, whose entries the footer counts.
const WEEKS_FILE = "weeks.json";

// The first two bytes of every gzip stream. A body without them was decompressed on the way, by a host that served the
// file with its gzip layer removed, and is read as it is.
const GZIP_MAGIC = Object.freeze([0x1f, 0x8b]);

// The status of a file that does not exist: a bucket of a prefix no top-level session of the week has, or a week the
// data does not hold.
const NOT_FOUND = 404;

/**
 * `{ tree, requests, toolCalls }`, the rows of the top-level session that holds the session `id` of the week `week`
 * (a Sunday), from the data folder at `dataUrl` (an absolute URL), each row an object from column name to value; null
 * when the week holds no session `id`. The id's bucket is fetched first; an id it does not hold, a subagent's, is
 * looked up in the week's index, and its top-level session's bucket fetched unless it is the same one.
 */
export async function fetchSession(dataUrl, week, id) {
  const bucket = await fetchJsonOrNull(bucketUrl(dataUrl, week, id));
  if (bucket !== null && Object.hasOwn(bucket, id)) {
    return sessionRows(bucket[id]);
  }
  const index = await fetchJsonOrNull(weekFileUrl(dataUrl, week, INDEX_FILE));
  if (index === null || !Object.hasOwn(index, id)) {
    return null;
  }
  const rootId = index[id];
  let rootBucket = bucket;
  // A subagent whose id shares its top-level session's prefix is in the bucket already fetched.
  if (prefixOf(rootId) !== prefixOf(id)) {
    rootBucket = await fetchJsonOrNull(bucketUrl(dataUrl, week, rootId));
  }
  if (rootBucket === null || !Object.hasOwn(rootBucket, rootId)) {
    throw new Error(`The index of the week of ${week} names the session ${rootId}, which its bucket does not hold`);
  }
  return sessionRows(rootBucket[rootId]);
}

/** The tool categories, most calls first, from the data folder at `dataUrl`: the order that fixes their colours. */
export async function fetchCategoryOrder(dataUrl) {
  const rows = await fetchJson(fileUrl(dataUrl, CATEGORY_ORDER_FILE));
  return rows.map((row) => row.category);
}

/** The number of weeks the data folder at `dataUrl` holds: the entries of its `weeks.json`. */
export async function fetchWeekCount(dataUrl) {
  const weeks = await fetchJson(fileUrl(dataUrl, WEEKS_FILE));
  return weeks.length;
}

/** A bucket entry's parts as the views take them: `{ tree, requests, toolCalls }`, each a list of row objects. */
export function sessionRows(entry) {
  return {
    tree: rowObjects(entry.tree),
    requests: rowObjects(entry.requests),
    toolCalls: rowObjects(entry.tool_calls),
  };
}

/** The rows of a part, `{ columns, rows }`, as objects from each column's name to the row's value in that column. */
export function rowObjects({ columns, rows }) {
  const objects = [];
  for (const values of rows) {
    const object = {};
    for (let i = 0; i < columns.length; i += 1) {
      object[columns[i]] = values[i];
    }
    objects.push(object);
  }
  return objects;
}

/** The text of a file's `bytes` (a Uint8Array): gunzipped when they start with gzip's magic number, else as they are. */
export async function bodyText(bytes) {
  if (!isGzipped(bytes)) {
    return new TextDecoder().decode(bytes);
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** Whether `bytes` start with gzip's magic number. */
export function isGzipped(bytes) {
  return bytes.length >= GZIP_MAGIC.length && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

/** The first characters of a session id that name its bucket. */
export function prefixOf(id) {
  return id.slice(0, PREFIX_LENGTH);
}

/** The absolute URL of the bucket of the week `week` that holds the top-level session `id`, or would. */
export function bucketUrl(dataUrl, week, id) {
  return weekFileUrl(dataUrl, week, `${encodeURIComponent(prefixOf(id))}${BUCKET_SUFFIX}`);
}

/** The absolute URL of the file `name` in the bucket folder of the week `week`. */
function weekFileUrl(dataUrl, week, name) {
  return fileUrl(dataUrl, `${BUCKETS_FOLDER}/${encodeURIComponent(week)}/${name}`);
}

/** The absolute URL of the file `path` in the data folder at `dataUrl`, with or without its trailing slash. */
function fileUrl(dataUrl, path) {
  // Without the slash, the URL resolution would put the file beside the data folder instead of in it.
  const folderUrl = dataUrl.endsWith("/") ? dataUrl : `${dataUrl}/`;
  return new URL(path, folderUrl).href;
}

/** The JSON value of the file at `url`, gzipped or not; null when it does not exist; throws on any other failure. */
async function fetchJsonOrNull(url) {
  const response = await fetch(url);
  return response.status === NOT_FOUND ? null : responseJson(url, response);
}

/** The JSON value of the file at `url`, gzipped or not; throws, naming the file, when it cannot be fetched. */
async function fetchJson(url) {
  return responseJson(url, await fetch(url));
}

/** The JSON value of the body of `response`, the answer to fetching `url`; throws naming `url` when it is not ok. */
async function responseJson(url, response) {
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return JSON.parse(await bodyText(new Uint8Array(await response.arrayBuffer())));
}
