-- A run keeps the model it asked for, the one its harness session reported,
-- and — when it failed — why, in a form every stage can show and act on
-- (category, the provider's public message, recovery). The newest finished
-- run per harness is that harness's last provider status.
alter table studio_build_runs add column if not exists model text;
alter table studio_build_runs add column if not exists reported_model text;
alter table studio_build_runs add column if not exists failure jsonb;
