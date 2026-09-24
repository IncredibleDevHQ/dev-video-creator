-- Planning records (M0): a video notebook's Explanation Brief and each
-- scene's creative plan, versioned. A record keeps the fingerprint of the
-- inputs it was made from, the pinned references, what the checks said, the
-- run and provider that made it, and where its materialised artifacts live.
-- Status changes are compare-and-swap on the current status, so a result
-- that arrives late can never overwrite newer work.
create table if not exists studio_planning_records (
  id text primary key,
  project_id text not null,
  kind text not null,
  subject text not null default '',
  revision integer not null,
  status text not null,
  fingerprint text not null,
  inputs jsonb not null default '{}'::jsonb,
  content jsonb,
  report jsonb,
  artifacts jsonb,
  run_id text,
  adapter text,
  model text,
  skill_bundle jsonb,
  workflow text,
  direction text not null default '',
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (project_id, kind, subject, revision)
);

create index if not exists studio_planning_records_subject_idx
  on studio_planning_records (project_id, kind, subject, revision desc);
create index if not exists studio_planning_records_run_idx on studio_planning_records (run_id);

-- The creator's planning inputs: direction for the whole video (subject '')
-- or one scene, and a scene's delivery once the creator chooses it (null
-- means undecided). Changing either makes plans made before it stale.
create table if not exists studio_planning_inputs (
  project_id text not null,
  subject text not null default '',
  direction text not null default '',
  delivery text,
  updated_at timestamptz not null default now(),
  primary key (project_id, subject)
);
