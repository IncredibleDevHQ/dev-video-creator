create table if not exists minimal_studio_artifacts (
  id text primary key,
  notebook_id text,
  scene_id text,
  moment_id text,
  kind text not null,
  bucket text not null,
  object_key text not null,
  s3_uri text not null,
  content_type text not null,
  byte_size bigint not null,
  sha256 text not null,
  status text not null check(status in ('pending','ready','failed','deleted')),
  created_at timestamptz not null default now(),
  unique(bucket,object_key)
);
create index if not exists minimal_artifacts_notebook on minimal_studio_artifacts(notebook_id,scene_id,kind);
create table if not exists minimal_studio_rows (
  kind text not null,
  id text not null,
  notebook_id text,
  document jsonb not null,
  artifact_id text references minimal_studio_artifacts(id),
  updated_at timestamptz not null default now(),
  primary key(kind,id)
);
create index if not exists minimal_rows_notebook on minimal_studio_rows(notebook_id,kind);

-- Notify only after the row is committed. Payloads contain an ID, never the
-- notebook document, credentials or media. LISTEN works across studio workers.
create or replace function minimal_notify_notebook() returns trigger as $$
begin
  if new.kind = 'projects' then
    perform pg_notify('minimal_studio_notebook', new.id);
  elsif new.kind = 'engine-runs' and new.notebook_id is not null then
    perform pg_notify('minimal_studio_notebook', new.notebook_id);
  end if;
  return new;
end;
$$ language plpgsql;
create or replace trigger minimal_notebook_changed
after insert or update on minimal_studio_rows
for each row execute function minimal_notify_notebook();
