# page-master — pages from sources or a topic

Not written here: **vendor ppt-master** (MIT, https://github.com/hugohe3/ppt-master) with attribution and adapt it:

- keep: entry + routing, Plan → Do·Check·Act, the two confirmations, `design_spec.md §IX` with Audience move and Relationships, `spec_lock.md`, the executor manual and its module routing, the checker cadence and carrier receipt, topic-research with fact ids, failure recovery.
- change: the checker runs through the studio MCP (`validate_pages`) and our SVG contract (stable ids per structure, separated labels, directed connectors with markers, `data-role`, `data-anchor`, single-tspan numbers, clip containers — Core §6.4); PPTX export becomes optional; `svg_output/` maps to the notebook's `pages/`; speaker notes feed motion-master as narration.
- drop: PowerPoint-specific animation post-processing (motion is motion-master's), Confirm UI server (the app's dialogs are the gates), template libraries unless wanted.

Installation for the concept test: clone ppt-master beside the app, point `AGENTS.md` / `.claude/skills` at both `ppt-master` and `motion-master`, and let the harness route "make pages" to the former and "plan the motion" to the latter.
