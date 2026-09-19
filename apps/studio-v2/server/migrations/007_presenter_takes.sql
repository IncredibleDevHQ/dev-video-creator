-- Presenter takes and take selections (D3): every recorded take is an
-- immutable row referencing its media asset; the active take for a block is
-- a separate selection, so retakes never destroy earlier work and reopening
-- restores both the archive and the chosen edit.
create table if not exists studio_presenter_takes (
  id uuid primary key,
  notebook_id text not null,
  block_id text not null,
  asset_id uuid not null references studio_assets(id) on delete restrict,
  duration_ms integer not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists studio_take_selections (
  notebook_id text not null,
  block_id text not null,
  take_id uuid not null references studio_presenter_takes(id) on delete cascade,
  selected_at timestamptz not null default now(),
  primary key (notebook_id, block_id)
);

create index if not exists studio_presenter_takes_notebook_block_idx
  on studio_presenter_takes (notebook_id, block_id, created_at);
