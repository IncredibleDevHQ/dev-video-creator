-- A planning request is claimed once. While a record for the same project,
-- kind, subject and inputs is queued or running, another identical request
-- gets that record instead of starting a second run. Duplicates left by the
-- earlier race are superseded before the claim becomes a rule.
update studio_planning_records r
   set status = 'superseded',
       error = jsonb_build_object('message', 'a duplicate of an identical request that was already running'),
       updated_at = now()
 where r.status in ('queued', 'running')
   and exists (
     select 1 from studio_planning_records o
      where o.project_id = r.project_id and o.kind = r.kind and o.subject = r.subject
        and o.fingerprint = r.fingerprint and o.status in ('queued', 'running') and o.revision > r.revision
   );

create unique index if not exists studio_planning_records_active_claim
  on studio_planning_records (project_id, kind, subject, fingerprint)
  where status in ('queued', 'running');

-- What the harness session reported running, kept apart from the model the
-- run asked for.
alter table studio_planning_records add column if not exists reported_model text;
