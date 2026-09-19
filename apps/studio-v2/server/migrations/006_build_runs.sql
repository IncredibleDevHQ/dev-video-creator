-- Durable build runs and their stage outcomes (D3): every harness run is
-- recorded before its side effects begin, and each product stage leaves a
-- typed checkpoint with its input fingerprint, so a restart can see what
-- completed, what is stale, and where to resume.
create table if not exists studio_build_runs (
  id text primary key,
  project_id text,
  skill text not null,
  route text not null,
  adapter text not null,
  project_dir text not null,
  status text not null,
  inputs_hash text,
  resume_id text,
  exit_code integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists studio_build_stages (
  run_id text not null references studio_build_runs(id) on delete cascade,
  stage text not null,
  status text not null,
  fingerprint text,
  detail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (run_id, stage)
);

create index if not exists studio_build_runs_project_idx on studio_build_runs (project_id, started_at desc);
