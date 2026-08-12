create table if not exists studio_notebooks (
  id text primary key,
  title text not null,
  artifact jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists studio_blocks (
  notebook_id text not null references studio_notebooks(id) on delete cascade,
  block_id text not null,
  position integer not null,
  kind text not null,
  configuration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (notebook_id, block_id)
);

create table if not exists studio_assets (
  id uuid primary key,
  notebook_id text references studio_notebooks(id) on delete cascade,
  block_id text,
  object_key text not null unique,
  content_type text not null,
  byte_size bigint not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create table if not exists studio_recorded_blocks (
  id uuid primary key,
  notebook_id text not null references studio_notebooks(id) on delete cascade,
  block_id text not null,
  asset_id uuid not null references studio_assets(id) on delete restrict,
  duration_ms integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notebook_id, block_id)
);

create index if not exists studio_blocks_notebook_position_idx
  on studio_blocks (notebook_id, position);
create index if not exists studio_recorded_blocks_notebook_idx
  on studio_recorded_blocks (notebook_id);
