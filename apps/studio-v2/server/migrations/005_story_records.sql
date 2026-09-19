-- Story records (D2): the creator's narrative under its wording policy, and
-- the explanation model (claims, objects, relations with stable ids) derived
-- from the outline. Both content-addressed and immutable; a notebook's base
-- references the exact revisions it was built from.
create table if not exists studio_narrative_revisions (
  id text primary key,
  project_id text,
  source_revision text,
  origin text not null,
  wording_policy text not null,
  audience text,
  takeaway text,
  text text not null,
  hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists studio_explanation_models (
  id text primary key,
  project_id text,
  source_revision text,
  narrative_revision text,
  model jsonb not null,
  hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists studio_narrative_revisions_project_idx on studio_narrative_revisions (project_id);
create index if not exists studio_explanation_models_project_idx on studio_explanation_models (project_id);
