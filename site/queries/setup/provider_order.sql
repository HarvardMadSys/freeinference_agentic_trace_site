-- One row per provider, with its top-level requests over every week and every harness, largest first (ties by name):
-- the global order that gives each provider the same colour on every chart, whatever the selection.
SELECT provider,
       count(*) AS requests
FROM requests
WHERE is_top_level
GROUP BY provider
ORDER BY requests DESC, provider;
