-- How a planning, preview or production run went, as the product confirmed
-- it (U3 of the scene workspace plan): its milestones in order — started,
-- read its packet, published a draft section, handed its result in, refused
-- or accepted, checked in the player — and the plan sections published as
-- drafts. A bounded snapshot on the record itself, read with it.
alter table studio_planning_records add column if not exists progress jsonb;
