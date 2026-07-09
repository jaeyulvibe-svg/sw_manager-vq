-- 002_seed_data.sql inserted asset_requests rows with hardcoded `no` values
-- (REQ-2026-001..004) without ever calling nextval('request_seq'), so the
-- sequence backing the `no` default is still at its start value. The first
-- real insert from the app (request-view.tsx) collides with the seeded rows
-- ("duplicate key value violates unique constraint asset_requests_no_key").
-- Advance the sequence past the highest numeric suffix already in use.
select setval(
  'request_seq',
  greatest(
    1,
    coalesce(
      (select max(substring(no from '(\d+)$')::int) from public.asset_requests),
      0
    )
  ),
  true
);
