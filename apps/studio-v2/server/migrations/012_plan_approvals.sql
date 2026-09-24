-- Approving a scene plan pins it (P2): which inputs it was approved with —
-- its own fingerprint, the brief it came from and the visual cast it saw —
-- so the approval stays readable, and reads as stale, when they move.
-- Approval starts nothing: no artwork, voice, recording or production.
alter table studio_planning_records add column if not exists approval jsonb;
