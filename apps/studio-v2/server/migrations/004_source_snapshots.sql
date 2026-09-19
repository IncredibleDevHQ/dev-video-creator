-- Immutable source revisions (D1): every read of supplied material is
-- captured before dependent artifacts are generated. Ids are content-
-- addressed, so a re-fetch of identical content is a no-op and changed
-- content is a new revision. Content and brand evidence stay separate.
create table if not exists studio_source_revisions (
  id text primary key,
  project_id text,
  kind text not null,
  url text,
  brand_url text,
  title text,
  site text,
  hash text not null,
  content jsonb not null,
  brand_content jsonb,
  created_at timestamptz not null default now()
);

create index if not exists studio_source_revisions_project_idx on studio_source_revisions (project_id);
create index if not exists studio_source_revisions_hash_idx on studio_source_revisions (hash);
