-- Stage checkpoints carry scene/object identity (D3 follow-up): a per-scene
-- stage (preview, narrate, align-take, restore) or per-object stage
-- (object-review) inside one run no longer overwrites another scene's or
-- object's checkpoint — one scene's waiting state and pickup details survive
-- another scene's progress. Run-level stages (finish, export) keep the empty
-- subject, as do all existing rows, so they update in place exactly as before.
alter table studio_build_stages add column if not exists subject text not null default '';
alter table studio_build_stages drop constraint studio_build_stages_pkey;
alter table studio_build_stages add primary key (run_id, stage, subject);
