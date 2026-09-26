-- A sketch is played in the pinned player before it reads ready (R3 of the
-- scene-review review): 'verifying' sits between the harness's submission
-- and 'ready'. A record being verified is still active, so it keeps the
-- claim that stops an identical request from starting a second run.
drop index if exists studio_planning_records_active_claim;
create unique index if not exists studio_planning_records_active_claim
  on studio_planning_records (project_id, kind, subject, fingerprint)
  where status in ('queued', 'running', 'verifying');
