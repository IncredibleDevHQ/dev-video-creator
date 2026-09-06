# Routing — motion-master

Select exactly one route, then activate only its profile and the references its trigger table names.

| Request shape | Route | Authority |
|---|---|---|
| "animate this page / notebook", "plan the steps", "plan the build order", a new slide block with narration | Plan Motion — Default | `plan-motion.md` |
| the slide editor's *Plan from narration*, an API call with narration, "just plan it, no questions" | Plan Motion — Quick | `profiles/quick-plan.md` |
| a recorded take exists and must drive timing; "use my recording" | Reconcile Take | `reconcile-take.md` |

**Profiles (not routes).** They are loaded inside Plan Motion by the trigger table of the authority:

| Trigger | Load |
|---|---|
| any page | `references/levels.md`, `references/core.md`, `references/tokens.md` |
| the page has connectors or containment | `references/core.md` §2.2 (trace/connect) and `references/driver.md` §4.3 |
| a beat carries `camera` or the page is a diagram taller than the frame | `references/driver.md` §4.4 |
| any `count`, `swap` or `morph` | `references/driver.md` §4.5, `core.md` §2.2 |
| a presenter is on camera | the `stage-director` skill's references `stage-families.md`, `overlays.md`, `reframes.md`, `speech-timing.md` |
| two or more speakers | the `speaker-crew` skill's references |
| a take with tracks exists | `references/planner.md` §6 and `stage-director/references/speech-timing.md` |
| reduced motion or a hard duration | `references/levels.md` L10 |

Missing prerequisite (no page geometry, no narration and no notes): state it and stop the route; do not invent narration.
