-- Durable theme library (D1): saved themes with immutable, content-hashed
-- revisions. A palette edit creates a new revision; notebooks pin the theme
-- snapshot they were drawn with, so existing work never changes underfoot.
create table if not exists studio_themes (
  id text primary key,
  name text not null,
  source text not null default 'custom',
  site text,
  current_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists studio_theme_revisions (
  theme_id text not null references studio_themes(id) on delete cascade,
  revision integer not null,
  theme jsonb not null,
  hash text not null,
  created_at timestamptz not null default now(),
  primary key (theme_id, revision)
);

create index if not exists studio_theme_revisions_hash_idx on studio_theme_revisions (hash);
