-- The top-level session and the week of the session whose id is the one parameter; no row for an unknown id.
-- The id comes from the page's URL and is not part of the selection, so it is passed as a parameter rather than
-- through a selection table: this is the site's one query with a `?`.
SELECT root_session_id, week
FROM sessions
WHERE session_id = ?;
