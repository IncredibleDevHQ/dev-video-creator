-- Asset upload lifecycle (D0a): an asset row is reserved as 'pending'
-- before its bytes move to the object store, and only marked 'ready' after
-- the store confirms the byte count. Rows left pending by an interrupted
-- write are reconciled at startup. Existing rows predate the lifecycle and
-- are therefore already ready.
alter table studio_assets add column if not exists status text not null default 'ready';
alter table studio_assets add column if not exists sha256 text;

create index if not exists studio_assets_status_idx on studio_assets (status);
